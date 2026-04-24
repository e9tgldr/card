import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { ipHash, currentHourBucket } from '../_shared/ip.ts';
import { checkAndIncrement } from '../_shared/rate-limit.ts';

const ANON_HOURLY_LIMIT = 10;
const AUTHED_HOURLY_LIMIT = 60;
const BUCKET = 'voice-cache';

const DEFAULT_VOICE_IDS: Record<string, string | undefined> = {
  mn: Deno.env.get('ELEVENLABS_VOICE_ID_MN'),
  en: Deno.env.get('ELEVENLABS_VOICE_ID_EN'),
  cn: Deno.env.get('ELEVENLABS_VOICE_ID_CN'),
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { text?: string; lang?: string; voice_id?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request', source: 'fallback' }, 400); }

  const lang = (body.lang === 'en' || body.lang === 'cn') ? body.lang : 'mn';
  const text = body.text?.trim() ?? '';
  if (!text || text.length > 800) {
    return json({ ok: false, reason: 'bad_text', source: 'fallback' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Determine rate-limit bucket + quota based on auth.
  let bucketKey: string;
  let quota: number;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authed.auth.getUser();
    if (userData?.user) {
      bucketKey = `user:${userData.user.id}`;
      quota = AUTHED_HOURLY_LIMIT;
    } else {
      bucketKey = await ipHash(req);
      quota = ANON_HOURLY_LIMIT;
    }
  } else {
    bucketKey = await ipHash(req);
    quota = ANON_HOURLY_LIMIT;
  }

  const effectiveVoiceId = body.voice_id?.trim() || DEFAULT_VOICE_IDS[lang];
  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!effectiveVoiceId || !elevenKey) {
    return json({ ok: false, reason: 'no_key', source: 'fallback' });
  }

  const key = await sha256Hex(`${lang}|${effectiveVoiceId}|${text}`);
  const path = `${key}.mp3`;
  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  // Cache hit skips rate limit — cached audio is free.
  try {
    const head = await fetch(publicUrl, { method: 'HEAD' });
    if (head.ok) return json({ ok: true, url: publicUrl, source: 'cache' });
  } catch { /* fall through to synth */ }

  // Apply rate limit before synth.
  const hourBucket = currentHourBucket();
  const limit = await checkAndIncrement(admin, bucketKey, hourBucket, 'speak', quota);
  if (!limit.allowed) {
    return json({ ok: false, reason: 'rate_limited', source: 'fallback' });
  }

  try {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
        'accept': 'audio/mpeg',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.7 },
      }),
    });
    if (resp.status === 429 || !resp.ok) {
      return json({ ok: false, reason: `eleven_${resp.status}`, source: 'fallback' });
    }
    const audio = new Uint8Array(await resp.arrayBuffer());
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, audio, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (upErr) {
      console.error('voice-cache upload failed', upErr);
      return json({ ok: false, reason: 'upload_failed', source: 'fallback' });
    }
    return json({ ok: true, url: publicUrl, source: 'synth' });
  } catch (err) {
    console.error('elevenlabs call failed', err);
    return json({ ok: false, reason: 'exception', source: 'fallback' });
  }
});

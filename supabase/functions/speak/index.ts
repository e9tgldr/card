import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { ipHash, currentHourBucket } from '../_shared/ip.ts';
import { checkAndIncrement } from '../_shared/rate-limit.ts';

const HOURLY_LIMIT = 10;
const BUCKET = 'voice-cache';

const VOICE_IDS: Record<string, string | undefined> = {
  mn: Deno.env.get('ELEVENLABS_VOICE_ID_MN'),
  en: Deno.env.get('ELEVENLABS_VOICE_ID_EN'),
  cn: Deno.env.get('ELEVENLABS_VOICE_ID_CN'),
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { text?: string; lang?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const lang = (body.lang === 'en' || body.lang === 'cn') ? body.lang : 'mn';
  const text = body.text?.trim() ?? '';
  if (!text || text.length > 800) {
    return json({ ok: false, fallback: 'web-speech', reason: 'bad_text' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const hashVal = await ipHash(req);
  const bucket = currentHourBucket();
  const limit = await checkAndIncrement(admin, hashVal, bucket, 'speak', HOURLY_LIMIT);
  if (!limit.allowed) {
    return json({ ok: false, fallback: 'web-speech', reason: 'rate_limited' });
  }

  const voiceId = VOICE_IDS[lang];
  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!voiceId || !elevenKey) {
    return json({ ok: false, fallback: 'web-speech', reason: 'no_key' });
  }

  const key = await sha256Hex(`${lang}|${voiceId}|${text}`);
  const path = `${key}.mp3`;
  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  try {
    const head = await fetch(publicUrl, { method: 'HEAD' });
    if (head.ok) return json({ ok: true, url: publicUrl, cached: true });
  } catch { /* fall through */ }

  try {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
      return json({ ok: false, fallback: 'web-speech', reason: `eleven_${resp.status}` });
    }
    const audio = new Uint8Array(await resp.arrayBuffer());
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, audio, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (upErr) {
      console.error('voice-cache upload failed', upErr);
      return json({ ok: false, fallback: 'web-speech', reason: 'upload_failed' });
    }
    return json({ ok: true, url: publicUrl, cached: false });
  } catch (err) {
    console.error('elevenlabs call failed', err);
    return json({ ok: false, fallback: 'web-speech', reason: 'exception' });
  }
});

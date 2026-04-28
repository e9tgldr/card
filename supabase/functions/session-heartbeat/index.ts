// supabase/functions/session-heartbeat/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, reason: 'unauthorized' }, 401);
  }
  const userJwt = authHeader.slice(7).trim();
  if (!userJwt) return json({ ok: false, reason: 'unauthorized' }, 401);

  let body: { session_id?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const sessionId = body.session_id ?? '';
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  const { data: userResp, error: userErr } = await admin.auth.getUser(userJwt);
  if (userErr || !userResp.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const userId = userResp.user.id;

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profErr) return json({ ok: false, reason: 'server' }, 500);
  if (profile?.is_admin) return json({ ok: true, exempt: true });

  // Single conditional UPDATE — if the session_id matches we bump last_seen,
  // otherwise zero rows are affected and we report eviction.
  const { data: updated, error: updErr } = await admin
    .from('active_sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .select('user_id');

  if (updErr) return json({ ok: false, reason: 'server' }, 500);

  if (Array.isArray(updated) && updated.length === 1) {
    return json({ ok: true });
  }
  return json({ ok: false, evicted: true });
});

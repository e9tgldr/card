import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, reason: 'unauthorized' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authed = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: adminCheck, error: adminErr } = await authed.rpc('is_admin');
  if (adminErr || !adminCheck) {
    return json({ ok: false, reason: 'forbidden' }, 403);
  }

  let body: { tournament_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const { tournament_id } = body;
  if (!tournament_id) {
    return json({ ok: false, reason: 'missing_tournament_id' }, 400);
  }

  const admin = createClient(url, service);
  const { error } = await admin.rpc('finalize_tournament', { tid: tournament_id });
  if (error) {
    return json({ ok: false, reason: error.message }, 500);
  }

  return json({ ok: true });
});

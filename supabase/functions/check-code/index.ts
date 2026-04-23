import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) return json({ ok: false, reason: 'bad_request' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await admin
    .from('access_codes')
    .select('code, redeemed_by')
    .eq('code', code)
    .maybeSingle();

  if (error) return json({ ok: false, reason: 'server' }, 500);
  if (!data) return json({ ok: false, reason: 'not_found' }, 200);
  if (data.redeemed_by) return json({ ok: false, reason: 'already_used' }, 200);

  return json({ ok: true });
});

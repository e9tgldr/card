// recycle-otp-key — admin-only manual reset of a single OTP number.
// Clears redeemed_by + redeemed_at without touching the auth.users row, so
// the corresponding account remains intact and can keep logging in normally.
// Use case: an admin wants to free a number for re-distribution at an event
// without forcing the original user to delete their account.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { number?: unknown };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const number = Number(body.number);
  if (!Number.isInteger(number) || number < 1 || number > 1000) {
    return json({ ok: false, reason: 'bad_number' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user?.app_metadata?.is_admin) {
    return json({ ok: false, reason: 'forbidden' }, 403);
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin
    .from('otp_keys')
    .update({ redeemed_by: null, redeemed_at: null })
    .eq('number', number)
    .select()
    .maybeSingle();

  if (error) return json({ ok: false, reason: error.message }, 500);
  if (!data) return json({ ok: false, reason: 'not_found' }, 404);

  return json({ ok: true, number });
});

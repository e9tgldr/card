// list-otp-keys — admin-only listing of all 1000 OTP keys with status.
// Mirrors list-codes shape but reads otp_keys + joins username from profiles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

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
  const { data: keys, error } = await admin
    .from('otp_keys')
    .select('number, redeemed_by, redeemed_at')
    .order('number', { ascending: true });
  if (error) return json({ ok: false, reason: error.message }, 500);

  // Join usernames in a second query so we don't depend on the FK relationship
  // surfaced via PostgREST (auth.users isn't in PostgREST's exposed schemas).
  const userIds = Array.from(new Set(
    (keys ?? []).map((k) => k.redeemed_by).filter(Boolean) as string[],
  ));
  let nameById: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    nameById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.username]));
  }

  return json({
    ok: true,
    keys: (keys ?? []).map((k) => ({
      number: k.number,
      redeemed_by: k.redeemed_by,
      redeemed_at: k.redeemed_at,
      username: k.redeemed_by ? (nameById[k.redeemed_by] ?? null) : null,
    })),
  });
});

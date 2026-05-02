// redeem-otp-key — single-use numeric (1..1000) signup code.
// Mirrors the flow of redeem-code but reads from otp_keys instead of
// access_codes, and accepts a number rather than a text code.
//
// Per-IP rate limit: 30 attempts/hour. Brute-forcing the full 1-1000 space at
// that rate takes ~33 hours, by which point the operator can rotate the table
// or the rate-limit window will be hit. Each successful redemption consumes
// the number permanently.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { ipHash, currentHourBucket } from '../_shared/ip.ts';
import { checkAndIncrement } from '../_shared/rate-limit.ts';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const HOURLY_LIMIT = 30;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { number?: unknown; username?: unknown; password?: unknown };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const number = Number(body.number);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!Number.isInteger(number) || number < 1 || number > 1000) {
    return json({ ok: false, reason: 'bad_number' }, 200);
  }
  if (!USERNAME_RE.test(username)) {
    return json({ ok: false, reason: 'invalid_username' }, 200);
  }
  if (password.length < 4) {
    return json({ ok: false, reason: 'weak_password' }, 200);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  // Rate-limit by IP — keep brute-force costly even though each successful
  // attempt only creates a new account (no existing accounts are at risk).
  const ip = await ipHash(req);
  const bucket = currentHourBucket();
  const limit = await checkAndIncrement(admin, ip, bucket, 'redeem-otp-key', HOURLY_LIMIT);
  if (!limit.allowed) {
    return json({ ok: false, reason: 'rate_limited' }, 429);
  }

  // Block guest accounts from redeeming new keys (mirror redeem-code).
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (authHeader) {
    const { data: u } = await admin.auth.getUser(authHeader);
    if (u?.user) {
      const { data: prof } = await admin.from('profiles')
        .select('parent_user_id').eq('id', u.user.id).maybeSingle();
      if (prof?.parent_user_id) {
        return json({ ok: false, reason: 'guests_cannot_redeem' }, 403);
      }
    }
  }

  // 1. Validate number is unredeemed. Check BOTH redeemed_by AND redeemed_at
  //    so a row whose FK was nulled (e.g. via privileged DDL) still reads as
  //    used. Collapse not_found + already_used into a single response so the
  //    error path can't be used to enumerate which numbers exist vs are taken.
  const { data: keyRow, error: keyErr } = await admin
    .from('otp_keys')
    .select('number, redeemed_by, redeemed_at')
    .eq('number', number)
    .maybeSingle();

  if (keyErr) return json({ ok: false, reason: 'server' }, 500);
  if (!keyRow || keyRow.redeemed_by || keyRow.redeemed_at) {
    return json({ ok: false, reason: 'invalid_or_used' }, 200);
  }

  // 2. Reject if username is taken.
  const email = `${username}@users.local`;
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingProfile) return json({ ok: false, reason: 'username_taken' }, 200);

  // 3. Create auth user. OTP keys never grant admin.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
    app_metadata: { is_admin: false },
  });
  if (createErr || !created.user) {
    // Don't echo the upstream error message back to the client — it can leak
    // stack traces or internal state. Log server-side instead.
    console.error('otp createUser failed', createErr);
    return json({ ok: false, reason: 'create_failed' }, 500);
  }

  // 4. Atomically mark the key redeemed. The conditional UPDATE matches both
  //    null-fields so a key whose FK was nulled out-of-band still cannot be
  //    re-redeemed. If somebody else won the race, undo the user creation to
  //    keep the system consistent.
  const { error: markErr, data: marked } = await admin
    .from('otp_keys')
    .update({ redeemed_by: created.user.id, redeemed_at: new Date().toISOString() })
    .eq('number', number)
    .is('redeemed_by', null)
    .is('redeemed_at', null)
    .select()
    .maybeSingle();

  if (markErr || !marked) {
    const { error: delErr } = await admin.auth.admin.deleteUser(created.user.id);
    if (delErr) {
      // Orphan auth user — the row exists but no otp_key references it.
      // Log loudly so an operator can clean up; fail closed.
      console.error('otp rollback deleteUser failed; orphan user',
        { user_id: created.user.id, delErr });
    }
    return json({ ok: false, reason: 'invalid_or_used' }, 200);
  }

  // 5. Sign the new user in to return a session.
  const anonClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signIn.session) {
    return json({ ok: false, reason: 'signin_failed' }, 500);
  }

  return json({ ok: true, session: signIn.session });
});

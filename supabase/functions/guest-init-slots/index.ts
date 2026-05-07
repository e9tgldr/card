import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { assertActiveSession, SessionRevokedError } from '../_shared/assertActiveSession.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!auth) return json({ ok: false, reason: 'unauthorized' }, 401);
  const { data: u } = await admin.auth.getUser(auth);
  if (!u?.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const userId = u.user.id;

  const { data: profile } = await admin.from('profiles')
    .select('parent_user_id').eq('id', userId).maybeSingle();
  if (profile?.parent_user_id) return json({ ok: false, reason: 'guests_cannot_init' }, 403);

  try {
    await assertActiveSession(admin, userId, req.headers.get('x-session-id'));
  } catch (e) {
    if (e instanceof SessionRevokedError) return json({ ok: false, reason: 'session_revoked' }, 401);
    throw e;
  }

  // The guest_slots_cap_trg trigger raises before INSERT when count(*) >= 5,
  // so a blind upsert with ignoreDuplicates still 500s for already-seeded
  // parents. Look at what's there and only insert missing indices.
  const { data: existing } = await admin.from('guest_slots')
    .select('slot_idx').eq('parent_user_id', userId);
  const have = new Set((existing ?? []).map((r: { slot_idx: number }) => r.slot_idx));
  const missing = [1, 2, 3, 4, 5].filter((i) => !have.has(i));
  if (missing.length === 0) return json({ ok: true });

  const rows = missing.map((slot_idx) => ({ parent_user_id: userId, slot_idx }));
  const { error } = await admin.from('guest_slots').insert(rows);
  if (error) return json({ ok: false, reason: 'server' }, 500);

  return json({ ok: true });
});

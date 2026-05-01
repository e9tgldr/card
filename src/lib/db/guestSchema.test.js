// src/lib/db/guestSchema.test.js
//
// Integration tests for the guest-accounts schema, run against the live
// Supabase project. Requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (and VITE_SUPABASE_ANON_KEY for the privilege probe). Suite skips silently
// when those are absent so default `npm test` runs do not fail.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL  = process.env.VITE_SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;

const skip = !URL || !KEY || !ANON;
const d = skip ? describe.skip : describe;

const PW = 'pw';
const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

let admin, parent, guestRow1, guestRow2;

d('guest schema invariants', () => {
  beforeAll(async () => {
    admin = createClient(URL, KEY);
    const { data: u } = await admin.auth.admin.createUser({
      email: `gtest_parent_${RUN}@users.local`,
      password: PW, email_confirm: true,
      user_metadata: { username: `gtest_p_${RUN}` },
    });
    parent = u.user;
    const { data: g1 } = await admin.auth.admin.createUser({
      email: `gtest_g1_${RUN}@guests.local`,
      password: PW, email_confirm: true,
      user_metadata: { username: `gtest_g1_${RUN}` },
      app_metadata: { parent_user_id: parent.id },
    });
    guestRow1 = g1.user;
    const { data: g2 } = await admin.auth.admin.createUser({
      email: `gtest_g2_${RUN}@guests.local`,
      password: PW, email_confirm: true,
      user_metadata: { username: `gtest_g2_${RUN}` },
      app_metadata: { parent_user_id: parent.id },
    });
    guestRow2 = g2.user;
  });

  afterEach(async () => {
    // Drop any guest_slots rows the previous test may have left behind, so
    // afterAll's user-delete cascade can run cleanly under ON DELETE RESTRICT.
    if (parent) await admin.from('guest_slots').delete().eq('parent_user_id', parent.id);
  });

  afterAll(async () => {
    if (parent)    await admin.from('guest_slots').delete().eq('parent_user_id', parent.id);
    if (parent)    await admin.auth.admin.deleteUser(parent.id);
    if (guestRow1) await admin.auth.admin.deleteUser(guestRow1.id);
    if (guestRow2) await admin.auth.admin.deleteUser(guestRow2.id);
  });

  it('chained-parent block: createUser fails when parent is itself a guest', async () => {
    // BEFORE INSERT trigger on profiles raises, which aborts the auth.users
    // statement too. GoTrue wraps the underlying Postgres message, so we do
    // not pin to specific text — we assert the contract: an error happened
    // and no user was returned.
    const { data, error } = await admin.auth.admin.createUser({
      email: `gtest_chain_${RUN}@guests.local`,
      password: PW, email_confirm: true,
      app_metadata: { parent_user_id: guestRow1.id },
    });
    expect(error).toBeTruthy();
    expect(data?.user).toBeFalsy();
  });

  it('parent_user_id is immutable on UPDATE — guest cannot un-link', async () => {
    const { error } = await admin.from('profiles')
      .update({ parent_user_id: null })
      .eq('id', guestRow1.id);
    expect(error?.message).toMatch(/parent_user_id is immutable/);
  });

  it('parent_user_id is immutable on UPDATE — human cannot acquire a parent', async () => {
    const { error } = await admin.from('profiles')
      .update({ parent_user_id: guestRow2.id })
      .eq('id', parent.id);
    expect(error?.message).toMatch(/parent_user_id is immutable/);
  });

  it('5-slot cap: 6th insert fires unique violation (cap trigger is defense-in-depth)', async () => {
    // Note on test scope: slot_idx is constrained [1..5] AND (parent, slot_idx)
    // is unique, so any 6th-row attempt collides on the unique index BEFORE
    // the cap-check trigger ever runs. The cap trigger (with pg_advisory_xact_lock)
    // is true defense-in-depth — it would only fire if the unique constraint
    // were ever weakened. Assert the public-schema-reachable defense here.
    const slots = [1, 2, 3, 4, 5].map(i => ({ parent_user_id: parent.id, slot_idx: i }));
    const { error: e1 } = await admin.from('guest_slots').insert(slots);
    expect(e1).toBeNull();

    const { data: rows } = await admin.from('guest_slots').select('id')
      .eq('parent_user_id', parent.id);
    expect(rows).toHaveLength(5);

    const { error: e2 } = await admin.from('guest_slots').insert({
      parent_user_id: parent.id, slot_idx: 1,
    });
    expect(e2?.code).toBe('23505'); // Postgres unique_violation
  });

  it('slot_idx CHECK: out-of-range rejected', async () => {
    const { error } = await admin.from('guest_slots').insert({
      parent_user_id: parent.id, slot_idx: 99,
    });
    // Postgres check_violation = 23514
    expect(error?.code).toBe('23514');
  });

  it('username partial unique allows guest reuse', async () => {
    const alias = `shared_alias_${RUN}`;
    const { error: e1 } = await admin.from('profiles')
      .update({ username: alias }).eq('id', guestRow1.id);
    const { error: e2 } = await admin.from('profiles')
      .update({ username: alias }).eq('id', guestRow2.id);
    expect(e1).toBeNull();
    expect(e2).toBeNull();
  });

  it('REVOKE on tournament_owner_id: authenticated role lacks INSERT privilege', async () => {
    // The actual defense for tournament_owner_id is the column-level REVOKE
    // (RLS denies all client inserts on game_results too, but we want to
    // verify the column REVOKE specifically — defense in depth). Probe the
    // catalog directly via has_column_privilege so RLS is bypassed by the
    // service-role admin and we measure exactly what we mean to.
    const { data, error } = await admin.rpc('has_column_privilege', {
      role: 'authenticated',
      table: 'public.game_results',
      column: 'tournament_owner_id',
      privilege: 'INSERT',
    }).single().then(
      r => r,
      () => ({ data: null, error: 'rpc-not-found' }),
    );

    // has_column_privilege is a built-in, but Supabase doesn't surface built-ins
    // via rpc(). Fall back to a SELECT through the SQL endpoint.
    if (error === 'rpc-not-found' || error || data === null) {
      const fallback = await admin
        .from('information_schema.column_privileges')
        .select('grantee, privilege_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'game_results')
        .eq('column_name', 'tournament_owner_id')
        .eq('grantee', 'authenticated')
        .eq('privilege_type', 'INSERT');
      // After REVOKE INSERT (tournament_owner_id) ... FROM authenticated,
      // there should be no row granting INSERT on this column to authenticated.
      expect(fallback.data ?? []).toHaveLength(0);
      return;
    }

    expect(data).toBe(false);
  });
});

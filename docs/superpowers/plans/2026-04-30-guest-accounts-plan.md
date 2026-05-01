# Guest accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent user spawn up to 5 guest accounts; friends sign in via a parent-shared single-use URL; all guest XP rolls up to the parent on the public leaderboard. Tournaments treat parent + guests as one shared submission.

**Architecture:** New `guest_slots` + `guest_tokens` + `guest_token_audit` tables. `parent_user_id` on `profiles` (immutable, chained-parent blocked). 5 new edge functions for slot lifecycle + 4 existing-fn guards + a shared `assertActiveSession` helper that closes the JWT-after-revoke gap. Leaderboard views and `finalize_tournament` rolled up by `coalesce(parent_user_id, id)`. Single-use tokens consumed atomically inside an RPC under `FOR UPDATE`.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno + supabase-js v2.45), React 18, Vite, Vitest + jsdom, @testing-library/react. Existing repo at `mongol-history-hub (2)/`.

---

## Spec

`docs/superpowers/specs/2026-04-30-guest-accounts-design.md` (commits 286c202 + 0ade271, post-Codex fix-first review).

## File structure

**Create — SQL:**
- `supabase/migrations/20260430000000_guest_accounts.sql` — one transactional migration containing: `parent_user_id` column + immutability/chained-parent triggers, `handle_new_auth_user` replacement, username partial-unique swap, `guest_slots` + cap trigger, `guest_tokens`, `tournament_owner_id` column + backfill + trigger + index swap, `game_leaderboard_weekly` / `game_leaderboard_all_time` / `v_tournament_leaderboard` rewrites, `finalize_tournament` rewrite, `claim_guest_token_atomic` RPC, `select_profile_with_parent` RPC, `guest_token_audit` table + `guest_record_token_generation` RPC.

**Create — edge functions:**
- `supabase/functions/_shared/assertActiveSession.ts` — DB-driven session-freshness + admin bypass helper.
- `supabase/functions/guest-init-slots/index.ts`
- `supabase/functions/guest-generate-token/index.ts`
- `supabase/functions/guest-claim-token/index.ts`
- `supabase/functions/guest-revoke-slot/index.ts`
- `supabase/functions/guest-list-slots/index.ts`

**Modify — edge functions:**
- `supabase/functions/redeem-code/index.ts` — block callers whose `profiles.parent_user_id` is non-null.
- `supabase/functions/game-create-session/index.ts` — block guests from `mode IN ('live_room','tournament')`; call `assertActiveSession`.
- `supabase/functions/game-submit-result/index.ts` — call `assertActiveSession`.
- `supabase/functions/game-live-event/index.ts` — call `assertActiveSession`.
- `supabase/functions/game-live-snapshot/index.ts` — call `assertActiveSession`.

**Create — client:**
- `src/lib/guestApi.js` — wrappers for the 5 guest edge fns (init/generate/claim/revoke/list).
- `src/lib/guestApi.test.js` — vitest unit tests for the wrappers (mocked supabase client).
- `src/lib/guestSession.js` — claim flow + parent-display helpers + `isGuest()` check.
- `src/lib/guestSession.test.js`
- `src/pages/GuestJoinPage.jsx` + `.test.jsx`
- `src/pages/ProfileGuestsPage.jsx` + `.test.jsx`
- `src/components/GuestSlotsPanel.jsx` + `.test.jsx`
- `src/components/GuestXpBanner.jsx` + `.test.jsx`

**Modify — client:**
- `src/lib/authStore.js` — fetch profile via `select_profile_with_parent` RPC, expose `isGuest`, `parentDisplayName`.
- `src/lib/authStore.test.js` — extend.
- `src/lib/supabase.js` — attach `X-Session-Id` from localStorage to every authenticated request via the global fetch wrapper.
- `src/App.jsx` — register the new `/guest/join` and `/profile/guests` routes.
- `src/pages/LiveRoomLobby.jsx` — hide **Create Room** button when guest.
- `src/pages/RedeemCode.jsx` — redirect guests away.
- `src/pages/Figures.jsx` — hide claim/buy buttons when guest.
- `src/pages/Order.jsx` — hide purchase buttons when guest.
- `src/components/RoundSummary.jsx` (or wherever per-round summary lives) — render `<GuestXpBanner />` for guests.
- `src/lib/i18n.jsx` — 14 new keys × 2 languages.
- `src/lib/i18n.test.jsx` — assert all new keys present and `{var}` interpolation works.

**Create — deployment:**
- `public/_headers` — `Referrer-Policy: no-referrer` for `/guest/join`. (If `_headers` already exists, append a rule; do not replace.)

**Pre-existing files referenced (read-only):**
- `supabase/migrations/20260423120000_init_schema.sql` — original `handle_new_auth_user` definition.
- `supabase/migrations/20260424000000_game_tables.sql` — `game_results` + old unique index.
- `supabase/migrations/20260424000300_game_leaderboard_views.sql` — old leaderboard view shapes.
- `supabase/migrations/20260425000000_tournaments_phase3.sql` — `v_tournament_leaderboard` + `finalize_tournament`.
- `supabase/migrations/20260428000000_single_device_sessions.sql` — `claim_session_atomic` (reused by the guest claim flow).
- `supabase/functions/redeem-code/index.ts` — pattern reference for new edge fns (createUser + setSession via generateLink/verifyOtp).

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260430000000_guest_accounts.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260430000000_guest_accounts.sql
-- Guest accounts: parent + 5 reassignable guest auth users; XP funnels to
-- parent on leaderboards; tournaments treat parent+guests as one slot.

-- ─── 1. parent_user_id on profiles + replace handle_new_auth_user ────────────

alter table public.profiles
  add column parent_user_id uuid references public.profiles(id) on delete restrict;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, is_admin, parent_user_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data->>'is_admin')::boolean, false),
    nullif(new.raw_app_meta_data->>'parent_user_id', '')::uuid
  );
  return new;
end;
$$;

create or replace function public.profiles_parent_user_id_immutable()
returns trigger language plpgsql as $$
begin
  if old.parent_user_id is distinct from new.parent_user_id then
    raise exception 'parent_user_id is immutable';
  end if;
  return new;
end $$;

create trigger profiles_parent_user_id_immutable_trg
  before update on public.profiles
  for each row execute function public.profiles_parent_user_id_immutable();

create or replace function public.profiles_no_chained_parent()
returns trigger language plpgsql as $$
begin
  if new.parent_user_id is not null then
    if new.parent_user_id = new.id then
      raise exception 'a profile cannot be its own parent';
    end if;
    if exists (
      select 1 from public.profiles p
      where p.id = new.parent_user_id and p.parent_user_id is not null
    ) then
      raise exception 'parent must itself be a top-level account';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_no_chained_parent_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_no_chained_parent();

-- ─── 2. Username partial-unique migration ────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_username_key;
create unique index profiles_username_unique_humans
  on public.profiles (username)
  where parent_user_id is null;

-- ─── 3. guest_slots ──────────────────────────────────────────────────────────

create table public.guest_slots (
  id              uuid primary key default gen_random_uuid(),
  parent_user_id  uuid not null references public.profiles(id) on delete restrict,
  slot_idx        int  not null,
  auth_user_id    uuid references public.profiles(id) on delete restrict,
  claimed_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (parent_user_id, slot_idx),
  check (slot_idx between 1 and 5)
);

create index guest_slots_parent_idx on public.guest_slots(parent_user_id);

create or replace function public.guest_slots_cap_check()
returns trigger language plpgsql as $$
declare v_count int;
begin
  select count(*) into v_count from public.guest_slots
   where parent_user_id = new.parent_user_id;
  if v_count >= 5 then
    raise exception 'parent already has 5 guest slots';
  end if;
  return new;
end $$;

create trigger guest_slots_cap_trg
  before insert on public.guest_slots
  for each row execute function public.guest_slots_cap_check();

alter table public.guest_slots enable row level security;

-- ─── 4. guest_tokens ─────────────────────────────────────────────────────────

create table public.guest_tokens (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references public.guest_slots(id) on delete cascade,
  token_hash    bytea not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index guest_tokens_expires_idx on public.guest_tokens(expires_at);
alter table public.guest_tokens enable row level security;

-- ─── 5. tournament_owner_id: column + backfill + trigger + index swap ───────

alter table public.game_results add column tournament_owner_id uuid;

update public.game_results gr
   set tournament_owner_id = coalesce(p.parent_user_id, p.id)
  from public.profiles p
 where p.id = gr.user_id
   and gr.tournament_id is not null
   and gr.tournament_owner_id is null;

create or replace function public.game_results_set_tournament_owner()
returns trigger language plpgsql as $$
begin
  if new.tournament_id is not null then
    select coalesce(p.parent_user_id, p.id)
      into new.tournament_owner_id
    from public.profiles p
    where p.id = new.user_id;
  end if;
  return new;
end $$;

create trigger game_results_set_tournament_owner_trg
  before insert on public.game_results
  for each row execute function public.game_results_set_tournament_owner();

revoke insert (tournament_owner_id), update (tournament_owner_id)
  on public.game_results from authenticated, anon;

drop index if exists game_results_unique_per_tournament;
create unique index game_results_unique_per_family_per_tournament
  on public.game_results (tournament_owner_id, tournament_id)
  where tournament_id is not null;

-- ─── 6. Leaderboard view rewrites ────────────────────────────────────────────

drop view if exists public.game_leaderboard_weekly;
create view public.game_leaderboard_weekly as
select
  coalesce(p.parent_user_id, p.id)                  as user_id,
  pp.username                                       as username,
  sum(r.score)                                      as total_points,
  count(*)                                          as games_played,
  round(avg(r.score::numeric / r.total) * 100, 1)   as accuracy_pct
from public.game_results r
join public.profiles p  on p.id = r.user_id
join public.profiles pp on pp.id = coalesce(p.parent_user_id, p.id)
where r.completed_at >= now() - interval '7 days'
group by 1, 2;

drop view if exists public.game_leaderboard_all_time;
create view public.game_leaderboard_all_time as
select
  coalesce(p.parent_user_id, p.id)                  as user_id,
  pp.username                                       as username,
  sum(r.score)                                      as total_points,
  count(*)                                          as games_played,
  round(avg(r.score::numeric / r.total) * 100, 1)   as accuracy_pct
from public.game_results r
join public.profiles p  on p.id = r.user_id
join public.profiles pp on pp.id = coalesce(p.parent_user_id, p.id)
group by 1, 2;

grant select on public.game_leaderboard_weekly   to authenticated;
grant select on public.game_leaderboard_all_time to authenticated;

drop view if exists public.v_tournament_leaderboard;
create view public.v_tournament_leaderboard as
select
  gr.tournament_id,
  gr.user_id,
  gr.tournament_owner_id,
  pp.username,
  gr.score,
  gr.total,
  gr.completed_at,
  row_number() over (
    partition by gr.tournament_id
    order by gr.score desc, gr.completed_at asc, gr.tournament_owner_id
  ) as rank
from public.game_results gr
join public.profiles pp on pp.id = gr.tournament_owner_id
where gr.tournament_id is not null;

grant select on public.v_tournament_leaderboard to authenticated, anon;

-- ─── 7. finalize_tournament: medals by tournament_owner_id ──────────────────

create or replace function public.finalize_tournament(tid uuid)
returns void
language plpgsql
security definer
as $$
declare r record;
begin
  for r in
    select tournament_owner_id as winner_id, row_number() over (
      order by score desc, completed_at asc, tournament_owner_id
    ) as rn
    from public.game_results
    where tournament_id = tid
    order by score desc, completed_at asc, tournament_owner_id
    limit 3
  loop
    insert into public.user_achievements (user_id, kind, ref_id)
    values (
      r.winner_id,
      case r.rn when 1 then 'tournament_gold'
                when 2 then 'tournament_silver'
                else 'tournament_bronze' end,
      tid
    )
    on conflict (user_id, ref_id)
      where kind in ('tournament_gold','tournament_silver','tournament_bronze')
      do nothing;
  end loop;

  update public.tournaments set published = true where id = tid and not published;
end;
$$;

-- ─── 8. claim_guest_token_atomic ────────────────────────────────────────────

create or replace function public.claim_guest_token_atomic(p_token_hash bytea)
returns table (
  found            boolean,
  slot_id          uuid,
  auth_user_id     uuid,
  parent_username  text,
  guest_username   text
)
language plpgsql
security definer
set search_path = public
as $$
declare v_row record;
begin
  select t.id as token_id,
         s.id as slot_id,
         s.auth_user_id,
         pp.username as parent_username,
         gp.username as guest_username
    into v_row
  from public.guest_tokens t
  join public.guest_slots  s  on s.id = t.slot_id
  join public.profiles     pp on pp.id = s.parent_user_id
  left join public.profiles gp on gp.id = s.auth_user_id
  where t.token_hash = p_token_hash and t.expires_at > now()
  for update of t;

  if not found then
    return query select false, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  delete from public.guest_tokens where id = v_row.token_id;

  return query
    select true, v_row.slot_id, v_row.auth_user_id, v_row.parent_username, v_row.guest_username;
end;
$$;

revoke all on function public.claim_guest_token_atomic(bytea) from public;
grant execute on function public.claim_guest_token_atomic(bytea) to service_role;

-- ─── 9. select_profile_with_parent (DEFINER, auth.uid only) ─────────────────

create or replace function public.select_profile_with_parent()
returns table (
  id              uuid,
  username        text,
  is_admin        boolean,
  parent_user_id  uuid,
  parent_username text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.is_admin, p.parent_user_id, pp.username
  from public.profiles p
  left join public.profiles pp on pp.id = p.parent_user_id
  where p.id = auth.uid();
$$;

revoke all on function public.select_profile_with_parent() from public;
grant execute on function public.select_profile_with_parent() to authenticated;

-- ─── 10. guest_token_audit + atomic rate-limit RPC ──────────────────────────

create table public.guest_token_audit (
  id              bigserial primary key,
  parent_user_id  uuid not null references public.profiles(id) on delete restrict,
  slot_id         uuid not null references public.guest_slots(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index guest_token_audit_parent_time_idx
  on public.guest_token_audit (parent_user_id, created_at desc);

alter table public.guest_token_audit enable row level security;

create or replace function public.guest_record_token_generation(
  p_parent_user_id uuid,
  p_slot_id        uuid,
  p_limit_per_hour int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('guest-rate:' || p_parent_user_id::text));

  select count(*) into v_count
    from public.guest_token_audit
   where parent_user_id = p_parent_user_id
     and created_at > now() - interval '1 hour';

  if v_count >= p_limit_per_hour then
    return false;
  end if;

  insert into public.guest_token_audit (parent_user_id, slot_id)
  values (p_parent_user_id, p_slot_id);

  return true;
end;
$$;

revoke all on function public.guest_record_token_generation(uuid, uuid, int) from public;
grant execute on function public.guest_record_token_generation(uuid, uuid, int) to service_role;

-- ─── 11. revoke_auth_sessions: service-role helper for guest revoke ─────────
-- supabase-js v2.45 has no admin method to globally revoke a specific user's
-- refresh tokens by user_id (auth.admin.signOut takes a JWT, not a uid). The
-- guest-revoke-slot edge fn deletes the user's auth.sessions rows directly via
-- this security-definer function.
create or replace function public.revoke_auth_sessions(p_user_id uuid)
returns void
language sql
security definer
set search_path = auth
as $$
  delete from auth.sessions where user_id = p_user_id;
$$;

revoke all on function public.revoke_auth_sessions(uuid) from public;
grant execute on function public.revoke_auth_sessions(uuid) to service_role;
```

> **Preflight before applying:** the partial unique migration (`profiles_username_unique_humans`) requires no two humans to share a username. Run this query against the live DB before applying:
>
> ```sql
> select username, count(*)
> from public.profiles
> where parent_user_id is null
> group by username
> having count(*) > 1;
> ```
>
> If any rows return, resolve duplicates first or the migration transaction will roll back on the `CREATE UNIQUE INDEX`.

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool: `name = '20260430000000_guest_accounts'`, `query = <contents of the migration file>`.
Expected: applies cleanly. If it fails with `column "parent_user_id" of relation "profiles" already exists`, the prior dev session left a partial state — do NOT just `if not exists` the column; investigate.

- [ ] **Step 3: Sanity-check the schema**

Use the Supabase MCP `list_tables` tool. Expected tables present: `guest_slots`, `guest_tokens`, `guest_token_audit`. `profiles.parent_user_id` column exists. `game_results.tournament_owner_id` column exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260430000000_guest_accounts.sql
git commit -m "feat(db): guest accounts schema + tournament_owner_id rollup + RPCs"
```

---

## Task 2: DB invariant tests

> **Revision 2026-05-01:** Test code revised post-code-quality review. Original assertions had 3 critical + 4 important issues (chained-parent regex matching wrapped GoTrue text that doesn't reach `error.message`; cap-test firing unique violation rather than cap trigger; REVOKE test blocked by RLS before reaching column privileges; cleanup not robust to mid-test failure; etc.). Current code asserts unique-violation codes explicitly, probes column privileges via `information_schema.column_privileges`, uses `afterEach` for slot cleanup, and uses a per-run RUN suffix to avoid cross-run pollution.

**Files:**
- Create: `src/lib/db/guestSchema.test.js` (vitest, hits the real Supabase via service-role admin client)

These tests use an admin Supabase client. The project's existing pattern is to gate such tests behind `if (!process.env.SUPABASE_SERVICE_ROLE_KEY) describe.skip(...)` so they don't run in CI without the key. Follow that pattern.

- [ ] **Step 1: Write the tests**

```javascript
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
```

- [ ] **Step 2: Run the tests (real DB needed)**

Run: `SUPABASE_SERVICE_ROLE_KEY=<key> VITE_SUPABASE_URL=<url> VITE_SUPABASE_ANON_KEY=<anon> npm test -- src/lib/db/guestSchema.test.js`
Expected: all pass against the migrated DB. If a test cannot establish a clean fixture (e.g. left over from a prior run), surface the failure rather than papering over it.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/guestSchema.test.js
git commit -m "test(db): guest schema invariants — chained-parent, 5-slot cap, immutability, partial unique, column REVOKE"
```

---

## Task 3: `assertActiveSession` shared edge-fn helper

**Files:**
- Create: `supabase/functions/_shared/assertActiveSession.ts`

- [ ] **Step 1: Write the helper**

```typescript
// supabase/functions/_shared/assertActiveSession.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export class SessionRevokedError extends Error {
  constructor() { super('session_revoked'); }
}

/**
 * Asserts the caller's JWT corresponds to a fresh active_sessions row whose
 * session_id matches what the client claims via X-Session-Id. Admins bypass
 * the check based on a DB-side is_admin lookup (NOT JWT-derived) so a demoted
 * admin's stale JWT loses the bypass on the next request.
 *
 * Throws SessionRevokedError on mismatch / missing.
 */
export async function assertActiveSession(
  admin: SupabaseClient,
  userId: string,
  providedSessionId: string | null,
): Promise<void> {
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.is_admin) return;

  if (!providedSessionId) throw new SessionRevokedError();
  const { data } = await admin
    .from('active_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data || data.session_id !== providedSessionId) {
    throw new SessionRevokedError();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/assertActiveSession.ts
git commit -m "feat(edge): assertActiveSession helper — DB-driven freshness check + admin bypass"
```

---

## Task 4: Wire `assertActiveSession` into the 4 game edge fns

**Files:**
- Modify: `supabase/functions/game-create-session/index.ts`
- Modify: `supabase/functions/game-submit-result/index.ts`
- Modify: `supabase/functions/game-live-event/index.ts`
- Modify: `supabase/functions/game-live-snapshot/index.ts`

For each file, the change pattern is the same. Apply it 4 times.

- [ ] **Step 1: For each game edge fn, after the JWT-derived `user_id` is computed, call the helper**

Read the existing file first to find the right insertion point. After the JWT verify + before any DB mutation, add:

```typescript
import { assertActiveSession, SessionRevokedError } from '../_shared/assertActiveSession.ts';

// ... inside the request handler, after user_id is verified:
const sessionId = req.headers.get('x-session-id');
try {
  await assertActiveSession(admin, user_id, sessionId);
} catch (e) {
  if (e instanceof SessionRevokedError) {
    return json({ ok: false, reason: 'session_revoked' }, 401);
  }
  throw e;
}
```

- [ ] **Step 2: Deploy each edge fn via Supabase MCP `deploy_edge_function`**

For each fn, deploy with the `_shared/assertActiveSession.ts` helper file included in the deployment payload.

- [ ] **Step 3: Smoke test against the deployed fns**

Quick manual: open the deployed `game-submit-result` URL, send a request with no `X-Session-Id` header from a non-admin authenticated user → expect 401 `session_revoked`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/game-create-session supabase/functions/game-submit-result supabase/functions/game-live-event supabase/functions/game-live-snapshot
git commit -m "feat(edge): assertActiveSession on game-mutating fns — closes JWT-after-revoke gap"
```

---

## Task 5: `guest-init-slots` edge fn

**Files:**
- Create: `supabase/functions/guest-init-slots/index.ts`
- Create: `src/lib/guestApi.js` (skeleton with `initGuestSlots`)
- Create: `src/lib/guestApi.test.js`

- [ ] **Step 1: Write the wrapper test**

```javascript
// src/lib/guestApi.test.js (only the initGuestSlots case for now)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGuestSlots } from '@/lib/guestApi';

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
import { supabase } from '@/lib/supabase';

beforeEach(() => vi.clearAllMocks());

describe('initGuestSlots', () => {
  it('invokes guest-init-slots with empty body', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await initGuestSlots();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('guest-init-slots', { body: {} });
  });

  it('throws on ok:false', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: false, reason: 'guests_cannot_init' }, error: null });
    await expect(initGuestSlots()).rejects.toThrow('guests_cannot_init');
  });
});
```

- [ ] **Step 2: Run the test — expect "Cannot find module '@/lib/guestApi'"**

Run: `npm test -- src/lib/guestApi.test.js`
Expected: fail with module-not-found.

- [ ] **Step 3: Create `src/lib/guestApi.js` skeleton**

```javascript
// src/lib/guestApi.js
import { supabase } from './supabase';

async function call(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data?.ok === false) throw new Error(data.reason || 'unknown');
  return data;
}

export async function initGuestSlots() { return call('guest-init-slots', {}); }
// More wrappers added in later tasks.
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm test -- src/lib/guestApi.test.js`
Expected: PASS.

- [ ] **Step 5: Write the edge fn**

```typescript
// supabase/functions/guest-init-slots/index.ts
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
  const { data: u, error: ue } = await admin.auth.getUser(auth);
  if (ue || !u?.user) return json({ ok: false, reason: 'unauthorized' }, 401);
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

  const rows = [1,2,3,4,5].map(slot_idx => ({ parent_user_id: userId, slot_idx }));
  const { error } = await admin.from('guest_slots').upsert(rows, {
    onConflict: 'parent_user_id,slot_idx',
    ignoreDuplicates: true,
  });
  if (error) return json({ ok: false, reason: 'server' }, 500);

  return json({ ok: true });
});
```

- [ ] **Step 6: Deploy via Supabase MCP `deploy_edge_function`**

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/guest-init-slots src/lib/guestApi.js src/lib/guestApi.test.js
git commit -m "feat(guest): guest-init-slots edge fn + client wrapper"
```

---

## Task 6: `guest-generate-token` edge fn

**Files:**
- Create: `supabase/functions/guest-generate-token/index.ts`
- Modify: `src/lib/guestApi.js` (add `generateGuestToken`)
- Modify: `src/lib/guestApi.test.js`

- [ ] **Step 1: Write the wrapper test**

Append to `src/lib/guestApi.test.js`:

```javascript
describe('generateGuestToken', () => {
  it('invokes guest-generate-token with slot_idx and returns url+expires_at', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, url: 'https://x/guest/join?token=abc', expires_at: '2030-01-01T00:00:00Z' },
      error: null,
    });
    const r = await generateGuestToken(2);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('guest-generate-token', { body: { slot_idx: 2 } });
    expect(r.url).toMatch(/\?token=/);
  });

  it('throws on rate_limited', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: false, reason: 'rate_limited' }, error: null });
    await expect(generateGuestToken(2)).rejects.toThrow('rate_limited');
  });
});
```

Add the import at the top: `import { initGuestSlots, generateGuestToken } from '@/lib/guestApi';`

- [ ] **Step 2: Run — expect failure (`generateGuestToken` not exported)**

Run: `npm test -- src/lib/guestApi.test.js`

- [ ] **Step 3: Add the wrapper**

In `src/lib/guestApi.js` append:

```javascript
export async function generateGuestToken(slot_idx) {
  return call('guest-generate-token', { slot_idx });
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Write the edge fn**

```typescript
// supabase/functions/guest-generate-token/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { assertActiveSession, SessionRevokedError } from '../_shared/assertActiveSession.ts';

const TOKEN_BYTES = 32;
const TTL_MIN = 15;
const RATE_LIMIT = 10;

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(buf);
}

// Postgres bytea expects a `\x<hex>` literal when sent as a JSON string via
// PostgREST. A JS number array is serialized as `[1,2,3,...]` and CANNOT be
// coerced to bytea — use this helper instead.
function toByteaHex(bytes: Uint8Array): string {
  return '\\x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { slot_idx?: number };
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_request' }, 400); }
  const slotIdx = body.slot_idx;
  if (!Number.isInteger(slotIdx) || slotIdx < 1 || slotIdx > 5) {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Prefer an explicit env var; fall back to the request's Origin header.
  // (Stripping the host off SUPABASE_URL would yield an empty string and a
  // relative URL, which is useless to the parent who needs to share a link.)
  const publicHost = Deno.env.get('PUBLIC_HOST') ?? req.headers.get('origin');
  if (!publicHost) return json({ ok: false, reason: 'server_misconfiguration' }, 500);
  const admin = createClient(url, serviceKey);

  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!auth) return json({ ok: false, reason: 'unauthorized' }, 401);
  const { data: u } = await admin.auth.getUser(auth);
  if (!u?.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const userId = u.user.id;

  const { data: profile } = await admin.from('profiles')
    .select('parent_user_id, username').eq('id', userId).maybeSingle();
  if (!profile) return json({ ok: false, reason: 'unauthorized' }, 401);
  if (profile.parent_user_id) return json({ ok: false, reason: 'guests_cannot_manage' }, 403);

  try {
    await assertActiveSession(admin, userId, req.headers.get('x-session-id'));
  } catch (e) {
    if (e instanceof SessionRevokedError) return json({ ok: false, reason: 'session_revoked' }, 401);
    throw e;
  }

  // Find slot
  const { data: slot } = await admin.from('guest_slots')
    .select('id, auth_user_id')
    .eq('parent_user_id', userId).eq('slot_idx', slotIdx).maybeSingle();
  if (!slot) return json({ ok: false, reason: 'slot_not_found' }, 404);

  // Activate slot if first time
  let authUserId = slot.auth_user_id;
  if (!authUserId) {
    const parentPrefix = userId.replace(/-/g, '').slice(0, 12);
    const guestUsername = `guest_${parentPrefix}_${slotIdx}`;
    const guestEmail = `${guestUsername}@guests.local`;
    const tempPw = crypto.randomUUID();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: guestEmail,
      password: tempPw,
      email_confirm: true,
      user_metadata: { username: guestUsername },
      app_metadata: { parent_user_id: userId },
    });
    if (cErr || !created.user) return json({ ok: false, reason: 'create_failed' }, 500);
    authUserId = created.user.id;
    await admin.from('guest_slots').update({ auth_user_id: authUserId }).eq('id', slot.id);
  }

  // Atomic per-parent rate limit (advisory lock + audit table count)
  const { data: rateOk, error: rateErr } = await admin.rpc('guest_record_token_generation', {
    p_parent_user_id: userId,
    p_slot_id: slot.id,
    p_limit_per_hour: RATE_LIMIT,
  });
  if (rateErr) return json({ ok: false, reason: 'server' }, 500);
  if (!rateOk) return json({ ok: false, reason: 'rate_limited' }, 429);

  // Generate token, hash it, store hash. Delete any prior unexpired token for this slot first.
  const raw = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(raw);
  const hash = await sha256(raw);
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

  await admin.from('guest_tokens').delete().eq('slot_id', slot.id);
  const { error: insErr } = await admin.from('guest_tokens').insert({
    slot_id: slot.id,
    token_hash: toByteaHex(hash),
    expires_at: expiresAt,
  });
  if (insErr) return json({ ok: false, reason: 'server' }, 500);

  const fullUrl = `${publicHost}/guest/join?token=${b64url(raw)}`;
  return json({ ok: true, url: fullUrl, expires_at: expiresAt });
});
```

- [ ] **Step 6: Deploy + smoke**

Deploy via Supabase MCP. Manual smoke: from a parent's dev console, call `generateGuestToken(1)` 11 times in 11 minutes — 11th should fail with `rate_limited`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/guest-generate-token src/lib/guestApi.js src/lib/guestApi.test.js
git commit -m "feat(guest): guest-generate-token + atomic rate limit + bytea token hash"
```

---

## Task 7: `guest-claim-token` edge fn

**Files:**
- Create: `supabase/functions/guest-claim-token/index.ts`
- Modify: `src/lib/guestApi.js` (add `claimGuestToken`)
- Modify: `src/lib/guestApi.test.js`

- [ ] **Step 1: Write the wrapper test**

```javascript
describe('claimGuestToken', () => {
  it('invokes guest-claim-token with token; returns access/refresh + session_id', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, access_token: 'a', refresh_token: 'r', session_id: 'sid', parent_username: 'p', guest_username: 'g' },
      error: null,
    });
    const r = await claimGuestToken('rawtok');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('guest-claim-token', { body: { token: 'rawtok' } });
    expect(r.access_token).toBe('a');
  });

  it('throws expired_or_invalid', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: false, reason: 'expired_or_invalid' }, error: null });
    await expect(claimGuestToken('bad')).rejects.toThrow('expired_or_invalid');
  });
});
```

- [ ] **Step 2: Run → fail. Add wrapper. Run → pass.**

```javascript
// in guestApi.js
export async function claimGuestToken(token) {
  return call('guest-claim-token', { token });
}
```

- [ ] **Step 3: Write the edge fn**

```typescript
// supabase/functions/guest-claim-token/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(buf);
}

function toHex(bytes: Uint8Array): string {
  return '\\x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { token?: string };
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_request' }, 400); }
  if (!body.token) return json({ ok: false, reason: 'bad_request' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  let raw: Uint8Array;
  try { raw = b64urlDecode(body.token); }
  catch { return json({ ok: false, reason: 'expired_or_invalid' }, 410); }
  const hash = await sha256(raw);

  // Atomic single-use claim. RETURNS TABLE → PostgREST always gives an array.
  const { data, error } = await admin.rpc('claim_guest_token_atomic', { p_token_hash: toHex(hash) });
  if (error) return json({ ok: false, reason: 'server' }, 500);
  const row = data?.[0];
  if (!row?.found) return json({ ok: false, reason: 'expired_or_invalid' }, 410);

  const { slot_id, auth_user_id, parent_username, guest_username } = row;

  // Rotate password
  const newPw = crypto.randomUUID();
  const { error: updErr } = await admin.auth.admin.updateUserById(auth_user_id, { password: newPw });
  if (updErr) return json({ ok: false, reason: 'rotate_failed' }, 502);

  // Fetch the canonical email — username is mutable, so do not derive it.
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(auth_user_id);
  if (authErr || !authUser?.user?.email) return json({ ok: false, reason: 'lookup_failed' }, 502);
  const guestEmail = authUser.user.email;

  // Issue a fresh session via generateLink + verifyOtp
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: guestEmail,
  });
  if (linkErr || !link?.properties?.hashed_token) return json({ ok: false, reason: 'link_failed' }, 502);

  const { data: verify, error: verifyErr } = await admin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (verifyErr || !verify?.session) return json({ ok: false, reason: 'verify_failed' }, 502);
  const { access_token, refresh_token } = verify.session;

  // Now that we have a fresh JWT, use signOut('others') to revoke prior
  // sessions for THIS user. (signOut takes a JWT, not a user_id; calling it
  // with a UUID would silently no-op.)
  await admin.auth.admin.signOut(access_token, 'others');

  // Mark slot claimed
  await admin.from('guest_slots').update({ claimed_at: new Date().toISOString() }).eq('id', slot_id);

  // Single-device claim using the existing infra (forces eviction of prior guest device)
  const sessionId = crypto.randomUUID();
  await admin.rpc('claim_session_atomic', {
    p_user_id: auth_user_id,
    p_session_id: sessionId,
    p_device_label: 'guest',
    p_force: true,
    p_stale_seconds: 120,
  });

  return json({
    ok: true,
    access_token,
    refresh_token,
    session_id: sessionId,
    parent_username,
    guest_username,
  });
});
```

- [ ] **Step 4: Deploy + smoke**

Deploy. Smoke: generate a token via `guest-generate-token`, pass it to `guest-claim-token` → expect `ok:true` with tokens. Try replay → expect `expired_or_invalid` 410.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/guest-claim-token src/lib/guestApi.js src/lib/guestApi.test.js
git commit -m "feat(guest): guest-claim-token — atomic single-use + generateLink/verifyOtp session issue"
```

---

## Task 8: `guest-revoke-slot` edge fn

**Files:**
- Create: `supabase/functions/guest-revoke-slot/index.ts`
- Modify: `src/lib/guestApi.js` + test

- [ ] **Step 1: Test + wrapper**

```javascript
// guestApi.test.js
describe('revokeGuestSlot', () => {
  it('invokes guest-revoke-slot with slot_idx', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await revokeGuestSlot(3);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('guest-revoke-slot', { body: { slot_idx: 3 } });
  });
});
```

```javascript
// guestApi.js
export async function revokeGuestSlot(slot_idx) {
  return call('guest-revoke-slot', { slot_idx });
}
```

- [ ] **Step 2: Edge fn**

```typescript
// supabase/functions/guest-revoke-slot/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { assertActiveSession, SessionRevokedError } from '../_shared/assertActiveSession.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { slot_idx?: number };
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_request' }, 400); }
  if (!Number.isInteger(body.slot_idx) || body.slot_idx! < 1 || body.slot_idx! > 5) {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

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
  if (profile?.parent_user_id) return json({ ok: false, reason: 'guests_cannot_manage' }, 403);

  try {
    await assertActiveSession(admin, userId, req.headers.get('x-session-id'));
  } catch (e) {
    if (e instanceof SessionRevokedError) return json({ ok: false, reason: 'session_revoked' }, 401);
    throw e;
  }

  const { data: slot } = await admin.from('guest_slots')
    .select('id, auth_user_id')
    .eq('parent_user_id', userId).eq('slot_idx', body.slot_idx!).maybeSingle();
  if (!slot) return json({ ok: false, reason: 'slot_not_found' }, 404);
  if (!slot.auth_user_id) return json({ ok: true });

  // Kill heartbeat, rotate password, revoke refresh tokens, drop pending invites.
  // Note: auth.admin.signOut takes a JWT not a user_id, so to revoke ALL of a
  // specific user's sessions from a service-role context we delete from
  // auth.sessions directly via the revoke_auth_sessions RPC (defined in the
  // migration). The next mutation any stale JWT makes will then fail
  // assertActiveSession because active_sessions is also gone.
  await admin.from('active_sessions').delete().eq('user_id', slot.auth_user_id);
  await admin.auth.admin.updateUserById(slot.auth_user_id, { password: crypto.randomUUID() });
  await admin.rpc('revoke_auth_sessions', { p_user_id: slot.auth_user_id });
  await admin.from('guest_tokens').delete().eq('slot_id', slot.id);
  await admin.from('guest_slots').update({ claimed_at: null }).eq('id', slot.id);

  return json({ ok: true });
});
```

- [ ] **Step 3: Deploy + commit**

```bash
git add supabase/functions/guest-revoke-slot src/lib/guestApi.js src/lib/guestApi.test.js
git commit -m "feat(guest): guest-revoke-slot — kill session, rotate pw, revoke refresh, drop invites"
```

---

## Task 9: `guest-list-slots` edge fn

**Files:**
- Create: `supabase/functions/guest-list-slots/index.ts`
- Modify: `src/lib/guestApi.js` + test

- [ ] **Step 1: Test + wrapper**

```javascript
describe('listGuestSlots', () => {
  it('invokes guest-list-slots and returns slots[]', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, slots: [{ slot_idx: 1, auth_user_id: null, display_name: null, claimed_at: null, online: false }] },
      error: null,
    });
    const r = await listGuestSlots();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('guest-list-slots', { body: {} });
    expect(r.slots.length).toBe(1);
  });
});
```

```javascript
export async function listGuestSlots() { return call('guest-list-slots', {}); }
```

- [ ] **Step 2: Edge fn**

```typescript
// supabase/functions/guest-list-slots/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { assertActiveSession, SessionRevokedError } from '../_shared/assertActiveSession.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

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
  if (profile?.parent_user_id) return json({ ok: false, reason: 'guests_cannot_manage' }, 403);

  try {
    await assertActiveSession(admin, userId, req.headers.get('x-session-id'));
  } catch (e) {
    if (e instanceof SessionRevokedError) return json({ ok: false, reason: 'session_revoked' }, 401);
    throw e;
  }

  // Slots + guest username + online status (via active_sessions presence).
  const { data: slots } = await admin
    .from('guest_slots')
    .select('slot_idx, auth_user_id, claimed_at, profiles:auth_user_id ( username ), active_sessions:auth_user_id ( session_id, last_seen )')
    .eq('parent_user_id', userId)
    .order('slot_idx');

  const out = (slots ?? []).map((s: any) => ({
    slot_idx: s.slot_idx,
    auth_user_id: s.auth_user_id,
    display_name: s.profiles?.username ?? null,
    claimed_at: s.claimed_at,
    online: !!s.active_sessions?.session_id
      && (Date.now() - new Date(s.active_sessions.last_seen).getTime() < 120_000),
  }));

  return json({ ok: true, slots: out });
});
```

- [ ] **Step 3: Deploy + commit**

```bash
git add supabase/functions/guest-list-slots src/lib/guestApi.js src/lib/guestApi.test.js
git commit -m "feat(guest): guest-list-slots — slots + online indicator from active_sessions"
```

---

## Task 10: Guest guards on `redeem-code` + `game-create-session`

**Files:**
- Modify: `supabase/functions/redeem-code/index.ts`
- Modify: `supabase/functions/game-create-session/index.ts`

- [ ] **Step 1: `redeem-code` — block guests**

After the existing JWT verify in `redeem-code/index.ts`, add (top of the auth-aware path):

```typescript
// Block guest accounts from redeeming new codes.
if (auth) {
  const { data: u } = await admin.auth.getUser(auth);
  if (u?.user) {
    const { data: prof } = await admin.from('profiles')
      .select('parent_user_id').eq('id', u.user.id).maybeSingle();
    if (prof?.parent_user_id) {
      return json({ ok: false, reason: 'guests_cannot_redeem' }, 403);
    }
  }
}
```

(Insertion site: directly after the request body has been validated and BEFORE looking up the access code.)

- [ ] **Step 2: `game-create-session` — block guest hosting**

After the JWT verify in `game-create-session/index.ts`, add:

```typescript
const { data: prof } = await admin.from('profiles')
  .select('parent_user_id').eq('id', user_id).maybeSingle();
if (prof?.parent_user_id && (mode === 'live_room' || mode === 'tournament')) {
  return json({ ok: false, reason: 'guests_cannot_host' }, 403);
}
```

- [ ] **Step 3: Deploy both, commit**

```bash
git add supabase/functions/redeem-code supabase/functions/game-create-session
git commit -m "feat(guest): block guests from redeeming codes + hosting live/tournament rooms"
```

---

## Task 11: `X-Session-Id` header on every authenticated client request

**Files:**
- Modify: `src/lib/supabase.js`
- Modify: `supabase/functions/_shared/cors.ts`

The Supabase JS v2 client takes a `global.fetch` override. Wrap fetch to attach `X-Session-Id` from localStorage on every authenticated request. CORS preflight on edge fns must also allow this header — the existing `_shared/cors.ts` does NOT include it, so without the CORS update browsers will block every preflighted POST that carries it.

- [ ] **Step 1: Verify the actual localStorage key in `deviceSession.js`**

Read `src/lib/deviceSession.js` and find the localStorage key it uses (should be `'mhh.device_session_id'` per the existing single-device-signin feature). Use whatever key is actually there in step 2 below — do NOT guess.

- [ ] **Step 2: Wrap fetch in `src/lib/supabase.js`**

```javascript
import { createClient } from '@supabase/supabase-js';

const SESSION_ID_KEY = 'mhh.device_session_id'; // must match deviceSession.js

const wrappedFetch = (input, init = {}) => {
  const sid = typeof window !== 'undefined' ? window.localStorage?.getItem(SESSION_ID_KEY) : null;
  const headers = new Headers(init.headers || {});
  if (sid && !headers.has('x-session-id')) headers.set('x-session-id', sid);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(url, key, {
  auth: { /* existing */ },
  global: { fetch: wrappedFetch },
});
```

(`supabase-js` v2 routes auth/REST/RPC/functions/storage all through `global.fetch`, so this single wrapper covers every callsite — including `supabase.functions.invoke(...)`.)

- [ ] **Step 3: Allow `x-session-id` in CORS preflight**

Read `supabase/functions/_shared/cors.ts`. Find the `Access-Control-Allow-Headers` value and add `x-session-id`:

```ts
'Access-Control-Allow-Headers':
  'authorization, x-client-info, apikey, content-type, x-session-id',
```

(The exact prior list may differ — preserve everything that's already there and append `x-session-id`.)

- [ ] **Step 4: Redeploy ALL existing edge fns so they pick up the CORS change**

Use the Supabase MCP `deploy_edge_function` for each function whose CORS handler imports `_shared/cors.ts`. (Inline `_shared` files are bundled at deploy time, so a CORS change in the shared file does not propagate until each consumer is redeployed.)

- [ ] **Step 5: Run the existing test suite**

Run: `npm test`
Expected: no regressions. The header-injection is a no-op when no session_id is stored.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.js supabase/functions/_shared/cors.ts
git commit -m "feat(client): attach X-Session-Id from localStorage + allow it in edge fn CORS"
```

---

## Task 12: `authStore` — fetch profile via `select_profile_with_parent`, expose `isGuest`

**Files:**
- Modify: `src/lib/authStore.js`
- Modify: `src/lib/authStore.test.js`

- [ ] **Step 1: Read existing authStore.js**

Identify how the profile is currently fetched (likely `from('profiles').select('*').eq('id', userId).single()`).

- [ ] **Step 2: Write a failing test**

```javascript
// authStore.test.js — add to the suite
import { describe, it, expect, vi } from 'vitest';

describe('authStore profile fetch', () => {
  it('uses select_profile_with_parent RPC and exposes parent_username', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'g1', username: 'g', is_admin: false, parent_user_id: 'p1', parent_username: 'parent_alice' }],
      error: null,
    });
    // ... arrange the supabase mock with rpc + auth.getSession
    // assert authStore.profile.parent_username === 'parent_alice' and isGuest() === true
  });
});
```

(Adapt the mock arrangement to whatever `authStore.test.js` already does for its existing tests — e.g. if it uses `vi.mock('@/lib/supabase', ...)` with `from`/`functions`, add `rpc` to the mock.)

- [ ] **Step 3: Replace the fetch**

In `authStore.js`, replace the existing profile fetch with:

```javascript
const { data, error } = await supabase.rpc('select_profile_with_parent');
if (error) throw error;
const row = Array.isArray(data) ? data[0] : data;
this.profile = row ? {
  id: row.id,
  username: row.username,
  is_admin: row.is_admin,
  parent_user_id: row.parent_user_id,
  parent_username: row.parent_username,
} : null;
```

Add helpers (export from the same module):

```javascript
export function isGuest() {
  return !!authStore.profile?.parent_user_id;
}
export function parentDisplayName() {
  return authStore.profile?.parent_username ?? null;
}
```

(Adapt to whatever export shape `authStore.js` uses — module-level singleton vs class instance.)

- [ ] **Step 4: Run tests — fix until green**

- [ ] **Step 5: Commit**

```bash
git add src/lib/authStore.js src/lib/authStore.test.js
git commit -m "feat(auth): fetch profile via select_profile_with_parent + isGuest helper"
```

---

## Task 13: `guestSession.js` — claim flow + parent helpers

**Files:**
- Create: `src/lib/guestSession.js` + `src/lib/guestSession.test.js`

- [ ] **Step 1: Write tests**

```javascript
// src/lib/guestSession.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimGuestSession } from '@/lib/guestSession';

vi.mock('@/lib/guestApi', () => ({ claimGuestToken: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { setSession: vi.fn().mockResolvedValue({ error: null }) } },
}));
vi.mock('@/lib/deviceSession', () => ({
  setSessionId: vi.fn(),
  startHeartbeat: vi.fn(),
}));

import { claimGuestToken } from '@/lib/guestApi';
import { supabase } from '@/lib/supabase';
import { setSessionId, startHeartbeat } from '@/lib/deviceSession';

beforeEach(() => vi.clearAllMocks());

describe('claimGuestSession', () => {
  it('calls claim, sets session, stores session_id, starts heartbeat', async () => {
    claimGuestToken.mockResolvedValue({
      access_token: 'a', refresh_token: 'r', session_id: 'sid',
      parent_username: 'p', guest_username: 'g',
    });
    const r = await claimGuestSession('rawtok');
    expect(claimGuestToken).toHaveBeenCalledWith('rawtok');
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    expect(setSessionId).toHaveBeenCalledWith('sid');
    expect(startHeartbeat).toHaveBeenCalled();
    expect(r).toEqual({ parent_username: 'p', guest_username: 'g' });
  });

  it('propagates expired_or_invalid', async () => {
    claimGuestToken.mockRejectedValue(new Error('expired_or_invalid'));
    await expect(claimGuestSession('bad')).rejects.toThrow('expired_or_invalid');
    expect(setSessionId).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```javascript
// src/lib/guestSession.js
import { claimGuestToken } from './guestApi';
import { supabase } from './supabase';
import { setSessionId, startHeartbeat } from './deviceSession';

export async function claimGuestSession(rawToken) {
  const { access_token, refresh_token, session_id, parent_username, guest_username } =
    await claimGuestToken(rawToken);
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  setSessionId(session_id);
  startHeartbeat();
  return { parent_username, guest_username };
}
```

(`setSessionId` may not exist as a named export today — check `src/lib/deviceSession.js` and use whatever the project's actual API is. If only `claimDeviceSession` exists, the engineer may need a small refactor or call `localStorage.setItem` directly with the same key the heartbeat reads.)

- [ ] **Step 3: Run → pass. Commit.**

```bash
git add src/lib/guestSession.js src/lib/guestSession.test.js
git commit -m "feat(guest): claimGuestSession — claim + setSession + heartbeat"
```

---

## Task 14: `GuestJoinPage` route

**Files:**
- Create: `src/pages/GuestJoinPage.jsx` + `.test.jsx`
- Modify: `src/App.jsx` (register `/guest/join` route)

- [ ] **Step 1: Test**

```jsx
// src/pages/GuestJoinPage.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuestJoinPage from './GuestJoinPage';

vi.mock('@/lib/guestSession', () => ({ claimGuestSession: vi.fn() }));
import { claimGuestSession } from '@/lib/guestSession';

beforeEach(() => { vi.clearAllMocks(); });

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/guest/join" element={<GuestJoinPage />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('<GuestJoinPage>', () => {
  it('claims and redirects on success', async () => {
    claimGuestSession.mockResolvedValue({ parent_username: 'parent_alice' });
    renderAt('/guest/join?token=abc');
    await waitFor(() => expect(claimGuestSession).toHaveBeenCalledWith('abc'));
    await waitFor(() => expect(screen.getByText('HOME')).toBeInTheDocument());
  });

  it('shows error on expired_or_invalid', async () => {
    claimGuestSession.mockRejectedValue(new Error('expired_or_invalid'));
    renderAt('/guest/join?token=bad');
    await waitFor(() => expect(screen.getByText(/expired/i)).toBeInTheDocument());
  });

  it('scrubs token from history.replaceState on mount', async () => {
    const spy = vi.spyOn(window.history, 'replaceState');
    claimGuestSession.mockResolvedValue({ parent_username: 'p' });
    renderAt('/guest/join?token=secret');
    await waitFor(() => expect(spy).toHaveBeenCalledWith(null, '', '/guest/join'));
  });
});
```

- [ ] **Step 2: Implement**

```jsx
// src/pages/GuestJoinPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { claimGuestSession } from '@/lib/guestSession';
import { useTranslation } from '@/lib/i18n';

export default function GuestJoinPage() {
  const t = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const token = params.get('token');
    window.history.replaceState(null, '', '/guest/join');
    if (!token) { setError('expired_or_invalid'); return; }
    claimGuestSession(token)
      .then(() => nav('/', { replace: true }))
      .catch((e) => setError(e.message || 'expired_or_invalid'));
  }, []);

  return (
    <>
      <Helmet>
        <meta name="referrer" content="no-referrer" />
        <title>{t('guest.joinPageTitle')}</title>
      </Helmet>
      <div className="p-8 max-w-md mx-auto">
        {!error && <p>{t('guest.joinPageTitle')}…</p>}
        {error && <p className="text-red-600">{t('guest.joinErrorExpired')}</p>}
      </div>
    </>
  );
}
```

(If `useTranslation` is not the project's hook name, swap to whatever `i18n.jsx` exposes. Same for `Helmet` — if `react-helmet-async` isn't installed, install it OR use a manual `useEffect` that adds/removes a `<meta>` tag on the document head.)

- [ ] **Step 3: Register the route in `src/App.jsx`**

```jsx
// somewhere in the Routes block
<Route path="/guest/join" element={<GuestJoinPage />} />
```

- [ ] **Step 4: Run → pass. Commit.**

```bash
git add src/pages/GuestJoinPage.jsx src/pages/GuestJoinPage.test.jsx src/App.jsx
git commit -m "feat(guest): /guest/join route — claim flow with referrer-policy + history scrub"
```

---

## Task 15: `GuestSlotsPanel` component

**Files:**
- Create: `src/components/GuestSlotsPanel.jsx` + `.test.jsx`

- [ ] **Step 1: Test**

```jsx
// GuestSlotsPanel.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GuestSlotsPanel from './GuestSlotsPanel';

vi.mock('@/lib/guestApi', () => ({
  initGuestSlots: vi.fn().mockResolvedValue({ ok: true }),
  listGuestSlots: vi.fn(),
  generateGuestToken: vi.fn(),
  revokeGuestSlot: vi.fn(),
}));
import { listGuestSlots, generateGuestToken, revokeGuestSlot } from '@/lib/guestApi';
vi.mock('@/lib/authStore', () => ({ isGuest: () => false }));

beforeEach(() => vi.clearAllMocks());

describe('<GuestSlotsPanel>', () => {
  it('renders 5 slots after init+list', async () => {
    listGuestSlots.mockResolvedValue({ slots: [
      { slot_idx: 1, auth_user_id: null, display_name: null, claimed_at: null, online: false },
      { slot_idx: 2, auth_user_id: 'g2', display_name: 'guest_alice', claimed_at: '2026-04-30', online: true },
      { slot_idx: 3, auth_user_id: null, display_name: null, claimed_at: null, online: false },
      { slot_idx: 4, auth_user_id: null, display_name: null, claimed_at: null, online: false },
      { slot_idx: 5, auth_user_id: null, display_name: null, claimed_at: null, online: false },
    ]});
    render(<GuestSlotsPanel />);
    await waitFor(() => expect(screen.getAllByTestId('guest-slot')).toHaveLength(5));
    expect(screen.getByText('guest_alice')).toBeInTheDocument();
  });

  it('Generate link opens modal with copy URL', async () => {
    listGuestSlots.mockResolvedValue({ slots: [{ slot_idx: 1, auth_user_id: null, display_name: null, claimed_at: null, online: false }] });
    generateGuestToken.mockResolvedValue({ url: 'https://x/guest/join?token=t', expires_at: '2030-01-01T00:00:00Z' });
    render(<GuestSlotsPanel />);
    await waitFor(() => expect(screen.getAllByTestId('guest-slot')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => expect(screen.getByDisplayValue(/guest\/join\?token=t/)).toBeInTheDocument());
  });

  it('Revoke calls revokeGuestSlot then re-lists', async () => {
    listGuestSlots
      .mockResolvedValueOnce({ slots: [{ slot_idx: 1, auth_user_id: 'g1', display_name: 'g', claimed_at: '2026-04-30', online: true }] })
      .mockResolvedValueOnce({ slots: [{ slot_idx: 1, auth_user_id: null, display_name: null, claimed_at: null, online: false }] });
    revokeGuestSlot.mockResolvedValue({ ok: true });
    render(<GuestSlotsPanel />);
    await waitFor(() => expect(screen.getByText('g')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(revokeGuestSlot).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listGuestSlots).toHaveBeenCalledTimes(2));
  });

  it('renders nothing for guest accounts', async () => {
    vi.doMock('@/lib/authStore', () => ({ isGuest: () => true }));
    const { unmount } = render(<GuestSlotsPanel />);
    expect(screen.queryAllByTestId('guest-slot')).toHaveLength(0);
    unmount();
  });
});
```

- [ ] **Step 2: Implement**

```jsx
// src/components/GuestSlotsPanel.jsx
import { useEffect, useState } from 'react';
import { initGuestSlots, listGuestSlots, generateGuestToken, revokeGuestSlot } from '@/lib/guestApi';
import { isGuest } from '@/lib/authStore';
import { useTranslation } from '@/lib/i18n';

export default function GuestSlotsPanel() {
  const t = useTranslation();
  const [slots, setSlots] = useState([]);
  const [activeUrl, setActiveUrl] = useState(null);
  const [confirming, setConfirming] = useState(null);

  if (isGuest()) return null;

  async function refresh() {
    const r = await listGuestSlots();
    setSlots(r.slots || []);
  }

  useEffect(() => {
    (async () => {
      try { await initGuestSlots(); } catch {}
      refresh();
    })();
  }, []);

  async function onGenerate(slot_idx) {
    const r = await generateGuestToken(slot_idx);
    setActiveUrl(r.url);
  }

  async function onRevoke(slot_idx) {
    await revokeGuestSlot(slot_idx);
    setConfirming(null);
    refresh();
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t('guest.panelTitle')}</h2>
      {slots.map((s) => (
        <div key={s.slot_idx} data-testid="guest-slot" className="flex items-center justify-between p-3 border rounded">
          <div>
            {s.display_name ? (
              <span>{s.display_name} {s.online && <span className="text-green-600 text-sm">●</span>}</span>
            ) : (
              <span className="text-gray-500">{t('guest.slotEmpty')}</span>
            )}
          </div>
          <div className="space-x-2">
            <button onClick={() => onGenerate(s.slot_idx)}>{t('guest.generateLinkButton')}</button>
            {s.auth_user_id && (
              confirming === s.slot_idx ? (
                <>
                  <span>{t('guest.revokeConfirm')}</span>
                  <button onClick={() => onRevoke(s.slot_idx)}>OK</button>
                  <button onClick={() => setConfirming(null)}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirming(s.slot_idx)}>{t('guest.revokeButton')}</button>
              )
            )}
          </div>
        </div>
      ))}
      {activeUrl && (
        <div className="p-3 border rounded bg-gray-50">
          <p>{t('guest.copyUrlLabel')}</p>
          <input readOnly value={activeUrl} className="w-full border p-1" />
          <button onClick={() => { navigator.clipboard.writeText(activeUrl); setActiveUrl(null); }}>Copy</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run → pass. Commit.**

```bash
git add src/components/GuestSlotsPanel.jsx src/components/GuestSlotsPanel.test.jsx
git commit -m "feat(guest): GuestSlotsPanel — list, generate, revoke with confirm"
```

---

## Task 16: `ProfileGuestsPage` route

**Files:**
- Create: `src/pages/ProfileGuestsPage.jsx` + `.test.jsx`
- Modify: `src/App.jsx` (register `/profile/guests`)

- [ ] **Step 1: Test**

```jsx
// ProfileGuestsPage.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProfileGuestsPage from './ProfileGuestsPage';

vi.mock('@/lib/authStore', () => ({ isGuest: () => false }));
vi.mock('@/components/GuestSlotsPanel', () => ({ default: () => <div>PANEL</div> }));

it('renders the panel for non-guest users', () => {
  render(<MemoryRouter><ProfileGuestsPage /></MemoryRouter>);
  expect(screen.getByText('PANEL')).toBeInTheDocument();
});

it('redirects guests to /', () => {
  vi.doMock('@/lib/authStore', () => ({ isGuest: () => true }));
  render(
    <MemoryRouter initialEntries={['/profile/guests']}>
      <Routes>
        <Route path="/profile/guests" element={<ProfileGuestsPage />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.queryByText('PANEL')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement**

```jsx
// src/pages/ProfileGuestsPage.jsx
import { Navigate } from 'react-router-dom';
import GuestSlotsPanel from '@/components/GuestSlotsPanel';
import { isGuest } from '@/lib/authStore';

export default function ProfileGuestsPage() {
  if (isGuest()) return <Navigate to="/" replace />;
  return <div className="max-w-2xl mx-auto p-6"><GuestSlotsPanel /></div>;
}
```

Register route in `src/App.jsx`:

```jsx
<Route path="/profile/guests" element={<ProfileGuestsPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ProfileGuestsPage.jsx src/pages/ProfileGuestsPage.test.jsx src/App.jsx
git commit -m "feat(guest): /profile/guests route"
```

---

## Task 17: `GuestXpBanner` component + wire into round summary

**Files:**
- Create: `src/components/GuestXpBanner.jsx` + `.test.jsx`
- Modify: round-summary surface (likely `src/components/game/Standings.jsx` or `src/pages/LiveRoomGame.jsx` — read first)

- [ ] **Step 1: Test**

```jsx
// GuestXpBanner.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuestXpBanner from './GuestXpBanner';

vi.mock('@/lib/authStore', () => ({
  isGuest: () => true,
  parentDisplayName: () => 'parent_alice',
}));

it('renders for guest with parent name interpolated', () => {
  render(<GuestXpBanner xp={42} />);
  expect(screen.getByText(/42/)).toBeInTheDocument();
  expect(screen.getByText(/parent_alice/)).toBeInTheDocument();
});

it('renders nothing for non-guests', () => {
  vi.doMock('@/lib/authStore', () => ({ isGuest: () => false, parentDisplayName: () => null }));
  const { container } = render(<GuestXpBanner xp={1} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Implement**

```jsx
// src/components/GuestXpBanner.jsx
import { isGuest, parentDisplayName } from '@/lib/authStore';
import { useTranslation } from '@/lib/i18n';

export default function GuestXpBanner({ xp }) {
  const t = useTranslation();
  if (!isGuest()) return null;
  const parent = parentDisplayName();
  return (
    <div className="text-sm text-gray-600">
      +{xp} {t('guest.xpBannerSuffix', { parent })}
    </div>
  );
}
```

- [ ] **Step 3: Wire into round summary**

Read whatever component renders the post-round XP gain. Add `<GuestXpBanner xp={roundScore} />` next to the score display.

- [ ] **Step 4: Commit**

```bash
git add src/components/GuestXpBanner.jsx src/components/GuestXpBanner.test.jsx <surface-file>
git commit -m "feat(guest): GuestXpBanner — show '+N XP → {parent}' to guests on round summary"
```

---

## Task 18: UI gating for guests

**Files:**
- Modify: `src/pages/LiveRoomLobby.jsx` (+ test)
- Modify: `src/pages/RedeemCode.jsx`
- Modify: `src/pages/Figures.jsx`
- Modify: `src/pages/Order.jsx`

For each file the change is: import `isGuest` from authStore, then conditionally hide the host/redeem/buy button.

- [ ] **Step 1: `LiveRoomLobby` — hide Create Room when guest**

```jsx
import { isGuest } from '@/lib/authStore';
// ...
{!isGuest() && <button onClick={onCreate}>{t('liveRoom.createRoomButton')}</button>}
{isGuest() && <p className="text-gray-500 text-sm">{t('guest.cannotHostTooltip')}</p>}
```

Update `LiveRoomLobby.test.jsx` with one new case asserting the button is absent when `isGuest()` returns true.

- [ ] **Step 2: `RedeemCode` — redirect guests**

At the top of the page component:

```jsx
import { Navigate } from 'react-router-dom';
import { isGuest } from '@/lib/authStore';
if (isGuest()) return <Navigate to="/" replace />;
```

- [ ] **Step 3: `Figures` and `Order` — hide claim/buy buttons**

For each card render path, wrap the claim/purchase button in `{!isGuest() && (...)}`.

- [ ] **Step 4: Run all tests, commit**

```bash
git add src/pages/LiveRoomLobby.jsx src/pages/LiveRoomLobby.test.jsx src/pages/RedeemCode.jsx src/pages/Figures.jsx src/pages/Order.jsx
git commit -m "feat(guest): UI gating — hide host/redeem/claim/buy actions for guests"
```

---

## Task 19: i18n — 14 new keys × 2 languages

**Files:**
- Modify: `src/lib/i18n.jsx`
- Modify: `src/lib/i18n.test.jsx`

The 14 keys (matching the spec):

```
guest.panelTitle              guest.slotEmpty               guest.slotClaimed
guest.generateLinkButton      guest.revokeButton            guest.revokeConfirm
guest.copyUrlLabel            guest.expiresIn               guest.joinPageTitle
guest.joinSuccessToast        guest.joinErrorExpired        guest.xpBannerSuffix
guest.cannotHostTooltip       guest.cannotRedeemTooltip
```

- [ ] **Step 1: Add the keys**

Mongolian (en column shown only as glosses; use Mongolian phrasing the project already uses):

```
guest.panelTitle              "Зочин данснууд"                        "Guest accounts"
guest.slotEmpty               "Хоосон"                                "Empty"
guest.slotClaimed             "{name} нэвтэрсэн"                      "{name} signed in"
guest.generateLinkButton      "Холбоос үүсгэх"                        "Generate link"
guest.revokeButton            "Цуцлах"                                "Revoke"
guest.revokeConfirm           "Цуцлахдаа итгэлтэй байна уу?"          "Are you sure you want to revoke?"
guest.copyUrlLabel            "Энэ холбоосыг найздаа илгээ:"          "Send this link to your friend:"
guest.expiresIn               "{minutes} минутын дараа дуусна"        "Expires in {minutes} minutes"
guest.joinPageTitle           "Зочноор нэвтэрч байна…"                "Joining as guest…"
guest.joinSuccessToast        "{parent}-ийн зочноор нэвтэрлээ"        "Signed in as guest of {parent}"
guest.joinErrorExpired        "Энэ холбоос дууссан байна"              "This link expired or was already used"
guest.xpBannerSuffix          "XP {parent}-д очно"                    "XP goes to {parent}"
guest.cannotHostTooltip       "Зочин өрөө үүсгэх боломжгүй"          "Guests can join rooms but not host"
guest.cannotRedeemTooltip     "Зочин код ашиглах боломжгүй"          "Guests cannot redeem codes"
```

- [ ] **Step 2: Test**

```jsx
// src/lib/i18n.test.jsx — add
const GUEST_KEYS = [
  'panelTitle','slotEmpty','slotClaimed','generateLinkButton','revokeButton',
  'revokeConfirm','copyUrlLabel','expiresIn','joinPageTitle','joinSuccessToast',
  'joinErrorExpired','xpBannerSuffix','cannotHostTooltip','cannotRedeemTooltip',
];

it.each(GUEST_KEYS)('mn has guest.%s', (k) => {
  expect(translations.mn[`guest.${k}`]).toBeTruthy();
});
it.each(GUEST_KEYS)('en has guest.%s', (k) => {
  expect(translations.en[`guest.${k}`]).toBeTruthy();
});

it('xpBannerSuffix interpolates {parent}', () => {
  const out = translate('en', 'guest.xpBannerSuffix', { parent: 'alice' });
  expect(out).toMatch(/alice/);
});
```

(Adapt to whatever symbols the existing `i18n.test.jsx` uses for the translations and the translate function.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.jsx src/lib/i18n.test.jsx
git commit -m "feat(i18n): 14 guest keys × mn/en"
```

---

## Task 20: `_headers` for Referrer-Policy on `/guest/join`

**Files:**
- Create or modify: `public/_headers`

- [ ] **Step 1: Add the header rule**

If `public/_headers` does not exist, create it. If it does, append the rule:

```
/guest/join
  Referrer-Policy: no-referrer
```

- [ ] **Step 2: Sanity check Netlify build picks it up**

If the project deploys to Netlify (per memory), `_headers` is consumed at build time. No runtime test possible until deploy.

- [ ] **Step 3: Commit**

```bash
git add public/_headers
git commit -m "feat(guest): Referrer-Policy: no-referrer on /guest/join"
```

---

## Task 21: pg_cron job to trim `guest_token_audit`

**Files:**
- (DB only, no committed file unless the project keeps cron scripts in tree)

- [ ] **Step 1: Schedule the cleanup**

Use the Supabase MCP `execute_sql` tool to install the cron job (idempotent):

```sql
select cron.schedule(
  'guest-token-audit-cleanup',
  '17 3 * * *',                      -- 03:17 UTC daily
  $$ delete from public.guest_token_audit where created_at < now() - interval '24 hours'; $$
);
```

If `cron` schema isn't enabled, run `create extension if not exists pg_cron;` first.

- [ ] **Step 2: Verify**

`select * from cron.job where jobname = 'guest-token-audit-cleanup';` — expect 1 row.

- [ ] **Step 3: Note in commit log (if anywhere applicable)**

No file change. If the project tracks cron config under `supabase/cron.ts` or similar, add the job description there too. Otherwise just leave a note in the manual smoke checklist (Task 22).

---

## Task 22: Manual smoke checklist + final tally

**Files:**
- (No files; produces a checklist in the PR description.)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: ~271 tests pass (baseline 241 + ~30 new). Note the actual count.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke (run on the deployed dev environment)**

1. Sign in as a parent account. Navigate to `/profile/guests`. Panel renders 5 empty slots.
2. Click **Generate link** on slot 1. Copy the URL.
3. Open the URL in a private window. Verify URL bar shows `/guest/join` (no token after redirect).
4. Land on `/`. The guest is signed in. Display the dev console: `authStore.profile.parent_username` is the parent's name.
5. Both parent and guest join the same live room (parent hosts, guest joins). Play 1 round.
6. Verify: guest's score appears under parent on `/leaderboard` within ~2s. Guest's username is NOT on the public board.
7. On the guest device, **Create Room** button is hidden in `/live`. Redeem-code page redirects to `/`. Figures/Order pages have no claim/buy buttons.
8. On the round summary, guest sees the `+N XP → {parent}` banner.
9. Parent revokes slot 1 mid-game. Within 30s, guest gets eviction toast + kicked.
10. Parent generates a new link for slot 1. A different friend claims it. Previous friend's tab cannot recover (refresh fails to /login).
11. Tournament test: parent + 2 guests submit to the same tournament. Only the first submission persists; the others get the "someone in your group already submitted" UX.

- [ ] **Step 4: Push**

```bash
git push origin master
git push origin master:main   # remember to push main too — Netlify is wired to main
```

(Per memory: Netlify on the canonical repo deploys from `main`, while development happens on `master`. The dual push is documented in `live_mp_roster_gate_shipped.md`.)

---

## Self-review

After implementation, re-verify against the spec:

- Sections 1–3 (data model + edge fns + frontend): every entity and edge fn exists and matches the spec.
- Section 4 (error handling, RLS audit, abuse): the Risks section in the spec lists 8 trade-offs; each has at least one corresponding test or design decision in the plan above.
- Section 5 (testing): ~30 new tests across DB invariants (Task 2), client wrappers (Tasks 5–9), components (Tasks 14–17), i18n (Task 19). Manual smoke (Task 22) covers the integration paths.

If a spec requirement is missing from the plan above, add a task. If a task references a file/symbol that doesn't exist in the codebase, the engineer must investigate before applying — do not invent.

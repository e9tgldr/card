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

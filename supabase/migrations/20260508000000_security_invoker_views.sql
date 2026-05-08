-- Fix Supabase advisor "Security Definer View" warnings on:
--   - public.game_leaderboard_weekly
--   - public.game_leaderboard_all_time
--   - public.v_tournament_leaderboard
--   - public.v_game_participants_safe
--
-- Postgres views default to security_invoker = false, which the advisor
-- flags because views then bypass RLS on their underlying tables.
--
-- Strategy:
--   * The three leaderboards must aggregate across ALL users, but the
--     underlying tables (game_results, profiles) are RLS-restricted to
--     "self" / "session members" / "admin". Plain invoker mode would
--     return only the caller's own row. We keep the views thin and
--     security_invoker = on, and move the cross-user query into a
--     SECURITY DEFINER function that returns only leaderboard-safe
--     columns — never game_results.answers, never profiles.is_admin.
--   * v_game_participants_safe just flips to invoker. The existing RLS
--     ('game_participants members read') already lets a participant see
--     all peer rows for their session; the view's CASE expression keeps
--     in-flight picks masked for everyone except the picker.

-- ─── 1. v_game_participants_safe — invoker only, no helper function ────────

drop view if exists public.v_game_participants_safe;
create view public.v_game_participants_safe with (security_invoker = on) as
  select
    session_id,
    user_id,
    joined_at,
    case
      when user_id = auth.uid() then current_round_answer
      else null
    end as current_round_answer
  from public.game_participants;
grant select on public.v_game_participants_safe to authenticated;

-- ─── 2. Helper functions for leaderboards (SECURITY DEFINER) ───────────────
-- Mirror the latest view definitions from 20260430000000_guest_accounts.sql
-- (family roll-up via parent_user_id).

create or replace function public._game_leaderboard_weekly_rows()
returns table (
  user_id      uuid,
  username     text,
  total_points bigint,
  games_played bigint,
  accuracy_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.parent_user_id, p.id)                  as user_id,
    pp.username                                       as username,
    sum(r.score)::bigint                              as total_points,
    count(*)::bigint                                  as games_played,
    round(avg(r.score::numeric / r.total) * 100, 1)   as accuracy_pct
  from public.game_results r
  join public.profiles p  on p.id = r.user_id
  join public.profiles pp on pp.id = coalesce(p.parent_user_id, p.id)
  where r.completed_at >= now() - interval '7 days'
  group by 1, 2;
$$;
revoke execute on function public._game_leaderboard_weekly_rows() from public;
grant execute on function public._game_leaderboard_weekly_rows() to authenticated, anon;

create or replace function public._game_leaderboard_all_time_rows()
returns table (
  user_id      uuid,
  username     text,
  total_points bigint,
  games_played bigint,
  accuracy_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.parent_user_id, p.id)                  as user_id,
    pp.username                                       as username,
    sum(r.score)::bigint                              as total_points,
    count(*)::bigint                                  as games_played,
    round(avg(r.score::numeric / r.total) * 100, 1)   as accuracy_pct
  from public.game_results r
  join public.profiles p  on p.id = r.user_id
  join public.profiles pp on pp.id = coalesce(p.parent_user_id, p.id)
  group by 1, 2;
$$;
revoke execute on function public._game_leaderboard_all_time_rows() from public;
grant execute on function public._game_leaderboard_all_time_rows() to authenticated, anon;

create or replace function public._tournament_leaderboard_rows()
returns table (
  tournament_id       uuid,
  user_id             uuid,
  tournament_owner_id uuid,
  username            text,
  score               int,
  total               int,
  completed_at        timestamptz,
  rank                bigint
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;
revoke execute on function public._tournament_leaderboard_rows() from public;
grant execute on function public._tournament_leaderboard_rows() to authenticated, anon;

-- ─── 3. Recreate the leaderboard views as invoker-mode wrappers ────────────

drop view if exists public.game_leaderboard_weekly;
create view public.game_leaderboard_weekly with (security_invoker = on) as
  select * from public._game_leaderboard_weekly_rows();
grant select on public.game_leaderboard_weekly to authenticated;

drop view if exists public.game_leaderboard_all_time;
create view public.game_leaderboard_all_time with (security_invoker = on) as
  select * from public._game_leaderboard_all_time_rows();
grant select on public.game_leaderboard_all_time to authenticated;

drop view if exists public.v_tournament_leaderboard;
create view public.v_tournament_leaderboard with (security_invoker = on) as
  select * from public._tournament_leaderboard_rows();
grant select on public.v_tournament_leaderboard to authenticated, anon;

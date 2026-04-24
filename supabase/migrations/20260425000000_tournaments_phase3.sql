-- Phase 3: tournament leaderboards, medals, finalize function.

-- ─── Task 1: user_achievements ───────────────────────────────────────────────

create table user_achievements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('tournament_gold','tournament_silver','tournament_bronze')),
  ref_id     uuid,
  awarded_at timestamptz not null default now()
);

-- one medal per user per tournament
create unique index user_achievements_one_medal_per_tournament
  on user_achievements (user_id, ref_id)
  where kind in ('tournament_gold','tournament_silver','tournament_bronze');

alter table user_achievements enable row level security;

create policy "achievements public read"
  on user_achievements for select using (true);
-- writes via service role only (finalize_tournament runs security definer)

-- ─── Task 2: v_tournament_leaderboard ────────────────────────────────────────

create or replace view v_tournament_leaderboard as
select
  gr.tournament_id,
  gr.user_id,
  p.username,
  gr.score,
  gr.total,
  gr.completed_at,
  row_number() over (
    partition by gr.tournament_id
    order by gr.score desc, gr.completed_at asc, gr.user_id
  ) as rank
from game_results gr
join profiles p on p.id = gr.user_id
where gr.tournament_id is not null;

grant select on v_tournament_leaderboard to authenticated, anon;

-- ─── Task 3: finalize_tournament(uuid) ───────────────────────────────────────

create or replace function finalize_tournament(tid uuid)
returns void
language plpgsql
security definer
as $$
declare r record;
begin
  for r in
    select user_id, row_number() over (
      order by score desc, completed_at asc, user_id
    ) as rn
    from game_results
    where tournament_id = tid
    order by score desc, completed_at asc, user_id
    limit 3
  loop
    insert into user_achievements (user_id, kind, ref_id)
    values (
      r.user_id,
      case r.rn when 1 then 'tournament_gold'
                when 2 then 'tournament_silver'
                else 'tournament_bronze' end,
      tid
    )
    on conflict (user_id, ref_id)
      where kind in ('tournament_gold','tournament_silver','tournament_bronze')
      do nothing;
  end loop;

  update tournaments set published = true where id = tid and not published;
end;
$$;

revoke all on function finalize_tournament(uuid) from public;
grant execute on function finalize_tournament(uuid) to service_role;

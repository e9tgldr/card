-- Quote-game multiplayer: leaderboard views (Phase 0).

create view game_leaderboard_weekly as
  select r.user_id,
         p.username,
         sum(r.score)                                        as total_points,
         count(*)                                            as games_played,
         round(avg(r.score::numeric / r.total) * 100, 1)     as accuracy_pct
    from game_results r
    join public.profiles p on p.id = r.user_id
   where r.completed_at >= now() - interval '7 days'
   group by r.user_id, p.username;

create view game_leaderboard_all_time as
  select r.user_id,
         p.username,
         sum(r.score)                                        as total_points,
         count(*)                                            as games_played,
         round(avg(r.score::numeric / r.total) * 100, 1)     as accuracy_pct
    from game_results r
    join public.profiles p on p.id = r.user_id
   group by r.user_id, p.username;

grant select on game_leaderboard_weekly   to authenticated;
grant select on game_leaderboard_all_time to authenticated;

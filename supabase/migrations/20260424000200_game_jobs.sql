-- Quote-game multiplayer: scheduled job to expire stale async duels (Phase 0).
create extension if not exists pg_cron;

create or replace function expire_open_duels()
returns void
language sql
security definer
set search_path = public
as $$
  update game_sessions
     set status = 'abandoned'
   where mode = 'async_duel'
     and status = 'open'
     and expires_at is not null
     and expires_at < now();
$$;

-- Every 15 minutes.
select cron.schedule(
  'expire-open-duels',
  '*/15 * * * *',
  $$select expire_open_duels();$$
);

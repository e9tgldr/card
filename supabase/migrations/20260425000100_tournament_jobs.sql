-- pg_cron job: finalize tournaments every 5 minutes.
select cron.schedule(
  'finalize-tournaments',
  '*/5 * * * *',
  $$
  do $inner$
  declare t record;
  begin
    for t in select id from tournaments
              where ends_at < now() and not published
    loop
      perform finalize_tournament(t.id);
    end loop;
  end;
  $inner$;
  $$
);

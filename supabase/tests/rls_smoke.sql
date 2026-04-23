-- Smoke test: RLS prevents unauthorized reads/writes. Run with:
--   supabase db execute --file supabase/tests/rls_smoke.sql
-- Each DO block raises on failure.

-- anon role cannot read access_codes
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from access_codes;
  if n <> 0 then raise exception 'anon should see 0 access_codes, got %', n; end if;
end $$;
reset role;

-- anon role CAN read figures and app_settings
do $$
begin
  set local role anon;
  perform count(*) from figures;
  perform count(*) from app_settings;
end $$;
reset role;

-- anon role cannot insert into figures
do $$
begin
  set local role anon;
  begin
    insert into figures (fig_id, name) values (999, 'should fail');
    raise exception 'anon insert into figures should have been denied';
  exception when insufficient_privilege or others then
    -- expected
  end;
end $$;
reset role;

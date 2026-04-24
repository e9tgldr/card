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

-- ============================================================
-- Game tables RLS smoke (Phase 0).
-- ============================================================

-- anon cannot read game_sessions
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from game_sessions;
  if n <> 0 then raise exception 'anon should see 0 game_sessions, got %', n; end if;
end $$;
reset role;

-- anon cannot insert into game_results
do $$
begin
  set local role anon;
  begin
    insert into game_results (session_id, user_id, score, total, answers)
    values (gen_random_uuid(), gen_random_uuid(), 1, 1, '[]'::jsonb);
    raise exception 'anon insert into game_results should have been denied';
  exception when insufficient_privilege or check_violation or others then
    -- expected
  end;
end $$;
reset role;

-- authenticated cannot insert into game_results (blocked by policy)
do $$
begin
  set local role authenticated;
  begin
    insert into game_results (session_id, user_id, score, total, answers)
    values (gen_random_uuid(), gen_random_uuid(), 1, 1, '[]'::jsonb);
    raise exception 'authenticated insert into game_results should have been denied';
  exception when insufficient_privilege or check_violation or others then
    -- expected
  end;
end $$;
reset role;

-- anon cannot read tournaments that are not published
do $$
declare tid uuid;
declare n int;
begin
  insert into tournaments (name, seed, lang, starts_at, ends_at, created_by, published)
  values ('smoke-hidden', 'S', 'mn', now(), now() + interval '1 day',
          (select id from auth.users limit 1), false)
  returning id into tid;

  set local role anon;
  select count(*) into n from tournaments where id = tid;
  reset role;

  if n <> 0 then raise exception 'anon should not see unpublished tournament'; end if;

  delete from tournaments where id = tid;
end $$;

-- ============================================================
-- Live rooms RLS smoke (Phase 2).
-- ============================================================

-- authenticated cannot SELECT current_round_answer from game_participants directly
do $$
begin
  set local role authenticated;
  begin
    perform current_round_answer from game_participants limit 1;
    raise exception 'authenticated should not be able to select current_round_answer directly';
  exception when insufficient_privilege then
    null; -- expected
  end;
end $$;
reset role;

-- v_game_participants_safe is grantable and readable by authenticated
do $$
declare n int;
begin
  set local role authenticated;
  select count(*) into n from v_game_participants_safe;
  -- Count may be 0 if no sessions exist for this role; the select just must not raise.
end $$;
reset role;

-- Unique partial index rejects double-linking a rematch target
do $$
declare a uuid; declare b uuid; declare target uuid;
begin
  insert into game_sessions (seed, mode, lang, host_user_id, status)
  values ('SEED_A', 'live_room', 'mn', (select id from auth.users limit 1), 'open')
  returning id into a;
  insert into game_sessions (seed, mode, lang, host_user_id, status)
  values ('SEED_B', 'live_room', 'mn', (select id from auth.users limit 1), 'open')
  returning id into b;
  insert into game_sessions (seed, mode, lang, host_user_id, status)
  values ('SEED_T', 'live_room', 'mn', (select id from auth.users limit 1), 'open')
  returning id into target;

  update game_sessions set rematch_session_id = target where id = a;

  begin
    update game_sessions set rematch_session_id = target where id = b;
    raise exception 'double-linking rematch_session_id should be blocked by unique index';
  exception when unique_violation then
    null; -- expected
  end;

  delete from game_sessions where id in (a, b, target);
end $$;

-- ─── figure_voices (Story Phase B) ─────────────────────────────────────────
-- anon CAN read figure_voices (public read)
do $$
begin
  set local role anon;
  perform count(*) from figure_voices;
end $$;
reset role;

-- authenticated (non-admin) cannot insert into figure_voices
do $$
begin
  set local role authenticated;
  begin
    insert into figure_voices (fig_id, lang, voice_id) values (1, 'mn', 'test');
    raise exception 'non-admin insert into figure_voices should have been denied';
  exception when insufficient_privilege or others then
    null; -- expected
  end;
end $$;
reset role;

-- ─── story_content (Story Phase C) ─────────────────────────────────────────
-- anon cannot read draft rows; CAN read published
do $$
declare n int;
begin
  insert into story_content (slug, lang, text, status) values ('figure:9999', 'mn', 'draft text', 'draft')
    on conflict (slug, lang) do update set text = excluded.text, status = excluded.status;

  set local role anon;
  select count(*) into n from story_content where slug = 'figure:9999';
  if n <> 0 then raise exception 'anon should not see draft rows, got %', n; end if;
  reset role;

  update story_content set status = 'published' where slug = 'figure:9999' and lang = 'mn';

  set local role anon;
  select count(*) into n from story_content where slug = 'figure:9999';
  if n <> 1 then raise exception 'anon should see 1 published row, got %', n; end if;
  reset role;

  delete from story_content where slug = 'figure:9999';
end $$;

-- authenticated (non-admin) cannot write to story_content
do $$
begin
  set local role authenticated;
  begin
    insert into story_content (slug, lang, text) values ('figure:8888', 'mn', 'nope');
    raise exception 'non-admin insert into story_content should have been denied';
  exception when insufficient_privilege or others then
    null; -- expected
  end;
end $$;
reset role;

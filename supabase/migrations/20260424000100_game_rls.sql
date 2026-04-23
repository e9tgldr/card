-- Quote-game multiplayer: RLS + SECURITY DEFINER helpers (Phase 0).
-- SECURITY DEFINER helpers prevent self-referential recursion in RLS SELECT
-- policies on game_participants/game_sessions.

create or replace function is_session_participant(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_participants
    where session_id = sid and user_id = auth.uid()
  );
$$;

create or replace function is_session_host(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_sessions
    where id = sid and host_user_id = auth.uid()
  );
$$;

alter table tournaments        enable row level security;
alter table game_sessions      enable row level security;
alter table game_participants  enable row level security;
alter table game_results       enable row level security;

-- --- tournaments ---
create policy "tournaments public read when published"
  on tournaments for select using (published = true or is_admin());
create policy "tournaments admin write"
  on tournaments for insert with check (is_admin());
create policy "tournaments admin update"
  on tournaments for update using (is_admin()) with check (is_admin());
create policy "tournaments admin delete"
  on tournaments for delete using (is_admin());

-- --- game_sessions ---
create policy "game_sessions host and participants read"
  on game_sessions for select using (
    host_user_id = auth.uid()
    or is_session_participant(id)
    or (tournament_id is not null
        and exists (select 1 from tournaments t
                    where t.id = game_sessions.tournament_id and t.published))
    or is_admin()
  );
create policy "game_sessions authenticated insert as host"
  on game_sessions for insert to authenticated
  with check (host_user_id = auth.uid());
create policy "game_sessions host update"
  on game_sessions for update
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());
create policy "game_sessions host delete when open/abandoned"
  on game_sessions for delete using (
    host_user_id = auth.uid() and status in ('open', 'abandoned')
  );

-- --- game_participants ---
create policy "game_participants members read"
  on game_participants for select using (
    is_session_participant(session_id) or is_session_host(session_id) or is_admin()
  );
create policy "game_participants self join"
  on game_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from game_sessions s where s.id = session_id and s.status = 'open')
  );
create policy "game_participants self leave while open"
  on game_participants for delete using (
    user_id = auth.uid()
    and exists (select 1 from game_sessions s where s.id = session_id and s.status = 'open')
  );

-- --- game_results ---
-- Reads: any participant of the session can see all results for that session.
create policy "game_results session members read"
  on game_results for select using (
    is_session_participant(session_id) or is_admin()
  );
-- Writes blocked for authenticated/anon. Service role (Edge Function) bypasses RLS.
create policy "game_results no client insert"
  on game_results for insert to authenticated with check (false);

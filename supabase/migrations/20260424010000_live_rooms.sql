-- Live rooms (Phase 2) — additive columns + masking view.

alter table game_sessions
  add column current_round_idx    int,
  add column current_sent_at      timestamptz,
  add column current_deadline     timestamptz,
  add column rematch_session_id   uuid references game_sessions(id) on delete set null;

-- Each new session can be the rematch target of at most one old session.
-- The rematch race itself is won via atomic `UPDATE ... WHERE rematch_session_id
-- IS NULL`; this index prevents double-linking.
create unique index game_sessions_rematch_target_unique
  on game_sessions (rematch_session_id)
  where rematch_session_id is not null;

alter table game_participants
  add column current_score          int   not null default 0,
  add column current_round_answer   jsonb;

-- Block direct SELECT of in-progress picks. Authenticated users read the
-- column through v_game_participants_safe, which masks other players' picks.
revoke select (current_round_answer) on game_participants from authenticated, anon;

create view v_game_participants_safe as
  select
    session_id,
    user_id,
    joined_at,
    current_score,
    case when user_id = auth.uid() or is_session_host(session_id)
         then current_round_answer
         else null
    end as current_round_answer
  from game_participants;

grant select on v_game_participants_safe to authenticated;

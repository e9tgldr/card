-- Live rooms: enforce column-level privacy for current_round_answer.
-- Supabase's default table-level grants to `authenticated` and `anon` cover
-- every column (existing + future), so the column-level REVOKE in the
-- previous migration had no effect. Fix: revoke table SELECT, grant only
-- the safe columns back. RLS still applies on top.

revoke select on game_participants from authenticated, anon;
grant select (session_id, user_id, joined_at, current_score)
  on game_participants to authenticated, anon;

-- Writes: INSERT / UPDATE / DELETE stay at table level — RLS policies
-- already restrict which rows / when, and the edge function uses the
-- service role for all multi-column writes. Users can still INSERT
-- their own {session_id, user_id} self-join row and DELETE it, which
-- is what the existing policies intend.

-- 20260427020000_live_room_eligible_figs.sql
-- Add a session-shared eligible-figure pool for live rooms. NULL means
-- "use the full FIGURES set" (legacy rows or verified-too-few-cards
-- intentional fallback). Populated only for mode='live_room' by
-- the game-create-session edge function, after a successful
-- card_ownership lookup. Lookup failures return 503 from the edge
-- function and never set this column to NULL.

alter table public.game_sessions
  add column if not exists eligible_fig_ids int[] null;

comment on column public.game_sessions.eligible_fig_ids is
  'Live-room only. int[] of fig_ids the round may draw quotes from. NULL = use full FIGURES.';

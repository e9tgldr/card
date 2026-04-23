# Quote Game — Live Rooms (Phase 2)

Continuation of [`2026-04-23-quote-game-multiplayer-design.md`](./2026-04-23-quote-game-multiplayer-design.md). Phase 0 (foundations) + Phase 1 (async duels + leaderboard) shipped on 2026-04-23. This spec covers Phase 2: real-time "party mode" game rooms for 2–8 players over Supabase Realtime.

## 1. Goals

- Let a host create a **live room** with a 6-character join code, invite friends, and run a synchronized round of the quote-guess game where all players see the same question at the same time with a visible timer.
- Keep anti-cheat and scoring guarantees identical to solo / async duels: the server is the source of truth for round content, answer correctness, and response time.
- Handle common failure modes gracefully: host rage-quit, one player's network drops, everyone closes the tab mid-game.
- Fit the existing codebase: reuse `buildRoundFromSeed`, `game-create-session`, the channel-agnostic round-playing UI, the ornament component library.

## 2. Non-goals

- Voice, video, text chat inside rooms.
- Spectator mode (join mid-game to watch, not play).
- Tournament × live-room combo (modes stay mutually exclusive).
- Per-player achievements or medals (Phase 3 concern).
- Reconnect with full event replay — snapshot-and-catch-up is sufficient.
- Horizontal scaling / sharded realtime — one Supabase project, one Realtime region. 8 players × handful of concurrent rooms is well within free-tier limits.

## 3. User flow

### 3.1 Create

1. User on `/games/quotes` sees a "Live room" button alongside "Solo" and "Challenge a friend".
2. Click lands on `/games/quotes/live/new`. Small form: language, round size (5/10/15 — subject to quote-pool cap), per-question timer (10/15/20 s), player cap (2–8, default 8).
3. Submit → `game-create-session(mode='live_room', …)` → returns `{ id, seed, join_code, share_path: '/games/quotes/live/<CODE>' }`.
4. Redirect to `/games/quotes/live/<CODE>`.

### 3.2 Lobby

The `/games/quotes/live/:code` route renders `LiveRoomLobby` while `status='open'`:

- Large join code display + QR.
- "Copy link" button.
- Player list with presence dots (via Realtime presence).
- Round settings — editable by host only while `status='open'`.
- **Start** button — host only, enabled when ≥ 2 players and host still connected. Disabled with reason otherwise.
- Non-host players see "Waiting for host to start…".

### 3.3 Round play

On **Start**, the lobby component switches to `LiveRoomGame` for everyone:

1. **Countdown**: 3-2-1 synced to `server_start_ts` from the `start` broadcast.
2. **Question phase**: everyone sees the same quote, 4 options, timer bar counting down from `timer_s`. Picking locks your answer locally and submits it. Timer expiry auto-submits `pickedFigId=null`.
3. **Answer indicator**: as others answer, small `✓` / `✗` markers appear next to names in a side Standings panel — **without revealing** each player's pick until reveal.
4. **Reveal phase (3 s)**: correct answer highlighted; each player's card flips to show ✓/✗ and their ms; Standings animates delta scores.
5. **Next question**: repeat until last round → **Results**.

### 3.4 Results

Final Standings (with MVP badge = highest correct; tiebreak total ms). "Rematch" button visible to all. First player to click wins the race: the server creates a fresh `live_room` session with them as host, broadcasts `rematch_ready { new_session_id, new_join_code }` to the old channel. Non-winners see "Join rematch" on the old results screen — click jumps them to the new room.

## 4. Architecture overview

Four pillars, roughly in order of authority:

1. **Postgres (authoritative state)** — `game_sessions`, `game_participants`, `game_results` hold the canonical state: whose turn it is, who answered what, what the running score is. No new tables; only additive columns.
2. **Edge Function `game-live-event`** — the only thing that writes state and the only thing that broadcasts on the Realtime channel. All game actions (start, answer, reveal, next_question, rematch) POST here. Service role bypasses RLS for writes and broadcasts.
3. **Supabase Realtime** — one channel per session: `game:session:<session_id>`. Clients subscribe (gated by RLS), send presence, and listen for server broadcasts. They never `broadcast()` themselves — the channel auth blocks it.
4. **Clients** — render state. Two routes (`/games/quotes/live/new` + `/games/quotes/live/:code`) and a handful of components. Reconnecting clients pull a snapshot via a second thin edge function.

### 4.1 Key design decisions (from brainstorm, 2026-04-24)

1. **Hybrid round-advancement loop.** Reveal is triggered EITHER by the last player's answer arriving OR by the server's per-round deadline — whichever comes first. Host can also early-reveal once all answered, but cannot stall past the deadline. *(Rationale: dead-host doesn't freeze the room; snappy when everyone's fast.)*
2. **Piggyback-on-events, no cron.** No dedicated tick-job polls for deadline expiry. Each client runs its own local countdown; on hitting 0 it fires a `timeout_null` event. Server uses event arrivals to advance. The existing `end_stale_live_rooms` cron (Phase 0, every 2 min, 5-min abandonment) is the safety net if every client disconnects. *(Rationale: simpler infra, no cron churn for a feature that's event-driven by nature.)*
3. **Server-authoritative timing, speed as tiebreaker.** `ms = now() - current_sent_at` computed on the server at answer arrival. Ranking is `(correct_count desc, total_ms asc)`. MVP = rank 1. *(Rationale: robust to client lying; speed-as-tiebreaker matches what the timer UI implicitly promises.)*
4. **Any-player first-wins rematch.** Everyone sees "Rematch" on results. First POST to `game-live-event {event:'rematch'}` wins via a CAS `UPDATE … WHERE rematch_session_id IS NULL`. *(Rationale: host may have closed the tab; no host/non-host asymmetry on end-screen.)*
5. **Single plan execution.** Phase 2 lands as one ~20-25-task plan, matching Phase 0+1's approach. *(Rationale: splitting doubles overhead for limited benefit; checkpoint-as-needed is the fallback.)*

## 5. Data model

All changes additive. No breaking migrations.

### 5.1 Migration `20260424010000_live_rooms.sql`

```sql
alter table game_sessions
  add column current_round_idx    int,
  add column current_sent_at      timestamptz,
  add column current_deadline     timestamptz,
  add column rematch_session_id   uuid references game_sessions(id) on delete set null;

-- Unique partial index doubles as the atomic CAS lock for the rematch race.
create unique index game_sessions_rematch_unique
  on game_sessions (id)
  where rematch_session_id is not null;

alter table game_participants
  add column current_score          int     not null default 0,
  add column current_round_answer   jsonb;  -- { pickedFigId, ms, correct } | null
```

### 5.2 Column semantics

- `current_round_idx` — which question index (0-based) clients should render. `null` before `start`, cleared on `end`.
- `current_sent_at` — set at each `question` broadcast (and at `start` for round 0). Used to compute `ms` server-side.
- `current_deadline` — `current_sent_at + timer_s * 1s + 500ms grace`. Server rejects `answer` events after this moment.
- `rematch_session_id` — populated when the rematch race is won. The partial-unique index gives us "first writer wins" semantics at the DB level, no app-level locking needed.
- `current_score` — updated on every `reveal`. Read by reconnecting clients.
- `current_round_answer` — ephemeral per-round scratch. Cleared on `next_question`. Contents only visible to the answering user (RLS below).

### 5.3 RLS updates (in the same migration)

```sql
-- Per-player answer visibility: only the user themselves or the session host
-- can read current_round_answer content. Everyone else sees nulls.
-- This is enforced by a view layer — the raw column is readable by any
-- participant under the existing game_participants policy, but clients should
-- select through v_game_participants_safe which masks the jsonb based on
-- auth.uid().

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
```

## 6. Edge Function `game-live-event`

Single POST endpoint. Fat switch on `event`. Every branch ends in `admin.channel('game:session:...').send({type:'broadcast', event:'...', payload})`.

### 6.1 Request shape

```ts
POST /functions/v1/game-live-event
Authorization: Bearer <user jwt>
Body: { session_id: string, event: string, payload?: object }

Responses:
  { ok: true, ...event-specific }
  { ok: false, reason: 'unauthorized'|'not_participant'|'not_host'|'bad_state'|
                       'too_late'|'already_answered_this_round'|'duplicate_rematch'|
                       'not_found'|'server', ... }
```

### 6.2 Event branches

| Event | Caller | Allowed states | Effect |
|---|---|---|---|
| `join` | authed user | `open` | Insert `game_participants` row (ignore on conflict). Broadcast `lobby_update`. |
| `leave` | participant | `open` | Delete `game_participants` row. Broadcast `lobby_update`. |
| `update_settings` | host | `open` | Update `lang` / `round_size` / `timer_s` on the session. Broadcast `lobby_update`. |
| `start` | host | `open` | Requires ≥ 2 participants. Set `status='in_progress'`, `current_round_idx=0`, `current_sent_at=now()`, `current_deadline=now() + timer_s*1s + 500ms`. Broadcast `start { server_start_ts, round_idx: 0, timer_s }`. |
| `answer` | participant | `in_progress` | Validate `round_idx == current_round_idx`. Reject if `now() > current_deadline` (reason `too_late`). Reject if `current_round_answer is not null` (reason `already_answered_this_round`). Compute `ms = now() - current_sent_at`. Validate `pickedFigId ∈ optionFigIds(round[current_round_idx])`; else treat as invalid (set `correct=false`, keep the null-equivalent pick). Write `current_round_answer = {pickedFigId, ms, correct}`. Broadcast `answer_submitted { user_id, correct, ms }`. If all present participants now have `current_round_answer is not null` → inline-call the `reveal` branch. |
| `timeout_null` | participant | `in_progress` | Same as `answer` with `pickedFigId=null, correct=false`. Used by clients whose local timer hit 0 before they picked. No `too_late` rejection — timeout_null *is* the signal that the timer expired client-side. |
| `reveal` | host OR internal | `in_progress` | Precondition: either all present answered OR `now() > current_deadline`. Compute standings = sum of `current_round_answer.correct` across rounds (rolling), update each `game_participants.current_score`. Broadcast `reveal { round_idx, correct_fig_id, standings }`. Start internal 3 s timer; when it elapses, inline-call `next_question` unless host already did. |
| `next_question` | host OR internal (auto after reveal) | `in_progress` | If `current_round_idx + 1 < round_size`: increment `current_round_idx`, clear `current_round_answer` for all participants, set fresh `current_sent_at` + `current_deadline`. Broadcast `question { round_idx, sent_at, timer_s }`. Else: inline-call `end`. |
| `end` | internal | `in_progress` | For each participant, insert a row in `game_results` with their rolled-up `score` + `answers` array. Set `status='complete'`. Broadcast `end { final_standings }`. |
| `host_gone` | any participant | `open` \| `in_progress` | Idempotent. If `host_user_id` still has presence → noop. Else pick new host = oldest `joined_at` among currently-present participants. Update `host_user_id`. Broadcast `host_changed { new_host_user_id }`. |
| `rematch` | any participant | `complete` | `UPDATE game_sessions SET rematch_session_id = new_id() WHERE id = <old> AND rematch_session_id IS NULL RETURNING rematch_session_id`. If zero rows returned → `{ok:false, reason:'duplicate_rematch', new_session_id: <existing>}`. Else: create a fresh `live_room` session with the current roster copied as participants, caller as host, same settings. Broadcast `rematch_ready { new_session_id, new_join_code }`. |

### 6.3 "Inline-call" pattern

Some branches invoke others server-side (all-answered → reveal; reveal timer expiry → next_question; last round → end). These aren't HTTP round-trips — they run in the same request handler as private async functions. Keeps the broadcast chain fast (answer → reveal in ~ms, not ~s).

For `reveal`'s internal 3s timer, we can't rely on `setTimeout` inside a Deno edge request (the request would hang). Instead:

- `reveal` branch sets `current_deadline = now() + 3s` *in reverse* — it's really "next_question allowed after" — and broadcasts `reveal` with a `next_question_at` field.
- Clients schedule their own local timer and the host's client sends `next_question` when it hits zero (or any participant's client does, via the same host-or-any relaxation we use for `host_gone`).
- If no client sends it (everyone disconnects during the 3s), `end_stale_live_rooms` eventually reaps the room.

This keeps the server stateless between requests.

## 7. Realtime channel

One channel per session: `game:session:<session_id>`.

- **Subscribe auth**: an RLS-gated `supabase_realtime.presence` policy — user must have a `game_participants` row for the session. Enforced via Supabase's Realtime authorization hooks.
- **Broadcasts**: sent exclusively by the edge function using the service-role client. Clients attempting to send `{type:'broadcast'}` from the JS SDK get rejected at the server — we'll set the channel's server-side policy to block broadcast sends from non-service-role JWTs.
- **Presence**: clients track themselves on the channel with `{user_id, last_ping_at}`. Host-gone detection waits for host's presence to drop ≥ 10 s.

### 7.1 Broadcast event catalogue

| Event | Payload | Trigger |
|---|---|---|
| `lobby_update` | `{ players: [{user_id, username, is_host}], settings: {lang, round_size, timer_s, player_cap} }` | join / leave / update_settings |
| `start` | `{ server_start_ts, round_idx: 0, timer_s }` | start |
| `question` | `{ round_idx, sent_at, timer_s }` | next_question |
| `answer_submitted` | `{ user_id, correct, ms }` (no pick) | answer / timeout_null |
| `reveal` | `{ round_idx, correct_fig_id, standings: [{user_id, score, last_correct, last_ms}], next_question_at }` | reveal |
| `end` | `{ final_standings }` | end |
| `host_changed` | `{ new_host_user_id }` | host_gone |
| `rematch_ready` | `{ new_session_id, new_join_code }` | rematch |

## 8. Client components

### 8.1 Refactor

Before building new UI, extract the in-round view from `GameQuoteGuess.jsx` into a reusable `RoundPlayer`:

**`src/components/game/RoundPlayer.jsx`**
```jsx
<RoundPlayer
  round={Question[]}           // from buildRoundFromSeed
  currentIdx={number}
  picked={number|null}         // figId or null
  onPick={(figId) => void}
  revealed={bool}              // reveal phase UI
  correctFigId={number|null}
  lang={'mn'|'en'}
/>
```

Solo game's `GameQuoteGuess.jsx` gets lightly refactored to use this. Live game uses the same component with different surrounding chrome.

### 8.2 New pages

- **`src/pages/LiveRoomNew.jsx`** — create form. Submits to `game-create-session(mode='live_room', ...)`. Redirects to `/games/quotes/live/:code`.
- **`src/pages/LiveRoomLobby.jsx`** — `status='open'` UI. Join code display, QR, player list with presence, host-only settings, Start button.
- **`src/pages/LiveRoomGame.jsx`** — `status='in_progress'` UI. Composes `RoundCountdown` / `RoundPlayer` / `Timer` / `Standings`. Transitions to internal results view on `end`.

A single route component (`/games/quotes/live/:code`) dispatches between these three based on current session status. It fetches via `game-live-snapshot` on mount and subscribes to the channel.

### 8.3 New components

- **`src/components/game/Timer.jsx`** — props `{ sentAt, timerS, onExpire }`. Renders a shrinking bar; calls `onExpire` when elapsed. Internally uses `requestAnimationFrame`.
- **`src/components/game/Standings.jsx`** — props `{ participants, scores, mode: 'lobby'|'in_round'|'reveal'|'final' }`. Ordered list with animated score deltas on reveal.
- **`src/components/game/RoundCountdown.jsx`** — props `{ startTs, onComplete }`. Renders 3-2-1-GO synced to server timestamp.

### 8.4 i18n keys (additive)

```js
'live.new.title'            // "New live room" / "Шинэ өрөө"
'live.new.lang'
'live.new.roundSize'
'live.new.timer'
'live.new.playerCap'
'live.new.submit'
'live.lobby.joinCode'
'live.lobby.players'
'live.lobby.start'
'live.lobby.startDisabledReason.minPlayers'
'live.lobby.waitingForHost'
'live.game.question'
'live.game.timer'
'live.game.standings'
'live.reveal.correct'
'live.reveal.nextIn'
'live.results.mvp'
'live.results.rematch'
'live.results.joinRematch'
'live.abandoned'
```

## 9. Reconnect

New edge function **`game-live-snapshot`** (GET). Query param: `session_id`. Returns:

```ts
{
  ok: true,
  session: { id, status, mode, lang, round_size, timer_s, host_user_id,
             current_round_idx, current_sent_at, current_deadline, rematch_session_id },
  participants: [{ user_id, username, joined_at, current_score,
                   current_round_answer /* own only, null for others */ }],
  last_reveal: { round_idx, correct_fig_id, standings } | null
}
```

Client behaviour on mount:

1. Call `game-live-snapshot(session_id)`.
2. Dispatch by `status`:
   - `open` → render `LiveRoomLobby`
   - `in_progress` → render `LiveRoomGame` at `current_round_idx`
     - Timer resumes from `current_sent_at`
     - Own answer pre-filled if `current_round_answer != null`
     - Standings pre-populated from `current_score`
   - `complete` → redirect to `/games/quotes/live/:code/results` which reads from `game_results`
   - `abandoned` → toast ("This room has ended") + redirect to `/games/quotes`
3. Subscribe to the Realtime channel. Every subsequent event updates in-memory state.

No event replay — missed broadcasts are recovered by the snapshot at mount time. Within-session disconnects rely on Supabase Realtime's own reconnect + any drift being reconciled on next broadcast.

## 10. Error handling & edge cases

| Case | Handling |
|---|---|
| Host tab closed mid-round | Host's presence drops. After 10 s, any still-present participant posts `host_gone`. Server reassigns. Room continues. |
| All participants disconnect | `end_stale_live_rooms` (Phase 0 cron, every 2 min) flips `status='abandoned'` after 5 min of no presence activity. |
| Player posts `answer` after their local timer expired but before server deadline | Accepted with their real `ms`. |
| Player posts `answer` after server deadline | Rejected with `{ok:false, reason:'too_late'}`. Client treats as timeout_null locally. |
| Player posts `answer` twice | Second rejected with `{ok:false, reason:'already_answered_this_round'}`. Client ignores the error (its local state already showed "locked"). |
| Broadcast fails silently | DB is authoritative. Next broadcast or reconnect snapshot reconciles. |
| Race: two players click Rematch simultaneously | CAS on `rematch_session_id`. Winner's response has the new session; loser's response includes `{reason:'duplicate_rematch', new_session_id: <winner's>}` and the loser's client treats that as a redirect to the existing new room. |
| Network partition during reveal 3 s | Host (or any client) will still fire `next_question` when their local timer expires. First to arrive wins, rest get a no-op. |
| Stale `current_round_idx` (client still on round N when server is at N+1) | Server rejects `answer` with `round_idx` mismatch. Client refetches snapshot. |
| `pickedFigId` not in `optionFigIds` | Server accepts the event but records `correct=false` and treats as a wrong answer. Prevents "guess any figId" cheating. |

## 11. Testing

### 11.1 Vitest unit (pure)

- `src/lib/liveScoring.js` (new): given `[{correct, ms}, ...]` per participant, produce a `Standings[]` ordered by `(correctCount desc, totalMs asc)`. MVP picker.
- `src/lib/timerGrace.js` (new): pure fn returning whether a given `(arrived_at, sent_at, timer_s)` is within deadline.
- Host-reassignment picker: given presence map + `joined_at` list, return next host user_id.

### 11.2 Vitest component

- `Timer.jsx` counts down; `onExpire` fires at t=0.
- `Standings.jsx` renders ordered players; score deltas animate on reveal.
- `RoundCountdown.jsx` renders 3-2-1 in sync with an injected `Date.now` stub.
- `RoundPlayer.jsx` used by both the solo game and a mock live game — same UI surface.

### 11.3 MCP-driven DB integration

A `docs/superpowers/specs/2026-04-24-live-rooms-smoke.sql` script (executed via `mcp execute_sql`) walks:

1. Insert 3 test users into `auth.users` (or pick existing).
2. Create a live_room session via direct insert (bypassing edge function).
3. Insert 3 participants.
4. Simulate `start` → set current_round_idx / sent_at / deadline.
5. Insert `current_round_answer` for each participant.
6. Check that inline-reveal conditions match what the edge function expects.
7. Walk 3 rounds.
8. Assert final `game_results` rows, `game_leaderboard_weekly` reflects them.

### 11.4 RLS smoke

Extend `supabase/tests/rls_smoke.sql`:
- `anon` cannot call `game-live-event` (handled in function).
- Non-participant cannot `SELECT * FROM v_game_participants_safe` for a session.
- Participant A cannot read participant B's `current_round_answer`.
- `host_user_id` reassignment only writable by service role.

### 11.5 Manual end-to-end

Captured as last task of the plan: open two browsers (host + player), create a 5-question live room, play through with a visible timer, verify reveal animation, results, rematch.

## 12. Implementation order (hint for plan writer)

1. Migration (columns + view).
2. `game-live-snapshot` edge function (simple read; unblocks client scaffolding).
3. `game-live-event` edge function — branches one at a time, with a simple per-branch smoke test: `join` → `start` → `answer` → `reveal` → `next_question` → `end` → `rematch`.
4. Client: route shell + `game-live-snapshot` hook.
5. `RoundPlayer` extraction + solo regression check.
6. `LiveRoomNew` → `LiveRoomLobby` → `LiveRoomGame` in that order.
7. `Timer`, `Standings`, `RoundCountdown` as needed by the pages.
8. Realtime subscription wiring + reconnect handler.
9. Manual end-to-end; fix anything surfaced.
10. README update + deviation log.

Rough task count estimate: 20–24. Single plan.

## 13. Deferred to later phases

- Spectator mode (Phase 2.5?): join mid-game, watch without playing. Requires a `spectator` role on `game_participants` or a separate table.
- In-room chat / reactions. Needs moderation strategy; out of scope.
- Tournament × live-room combination (a tournament evening where players compete in scheduled rooms). Phase 3 overlap.
- Per-player achievements on live rooms (e.g. "won 3 live rooms in a row"). Phase 3.

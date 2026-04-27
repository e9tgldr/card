# Live Multiplayer Roster Gate — Design

**Date:** 2026-04-27
**Status:** Approved (brainstorm)
**Follow-up to:** Sub-project 2 (solo roster gate shipped 2026-04-27, commit `3a8efe6`). The follow-up flagged in that commit's message — "live multiplayer not yet gated" — is what this spec closes.

## Goal

Constrain the question pool of a live multiplayer room to the host's owned figures (with quotes), mirroring the solo `GameQuoteGuess` gate. Today `LiveRoomGame.jsx` builds rounds against the full `FIGURES` set regardless of who hosts the room; this spec makes the round honour the host's collection.

## Decisions captured during brainstorm

- **Host's roster is the source.** The host's owned-figures-with-quotes set determines the eligible pool for everyone in the room. Captured at session creation. Computed server-side from the host's auth context — no per-participant negotiation.
- **Rationale:** simplest analogue of solo, fits the "host = source of truth for room settings" pattern that already governs `timer_s`, `player_cap`, `lang`, and `round_size`. Intersection-of-all-participants was rejected because the corpus only has 7 quote-bearing figures today, so any 3+ player room would trip the fallback constantly.
- **Tournaments are not gated.** Tournaments lock seed / lang / round_size from the tournament row precisely so every entrant faces the same questions; constraining the figure pool to one admin's collection would break that fairness guarantee. Schema-wise, `eligible_fig_ids` is only populated when `mode = 'live_room'`.
- **Fallback mirrors solo.** If the host has fewer than 4 owned-with-quotes figures, store `eligible_fig_ids = NULL` and the client treats NULL as "use full FIGURES". Lobby surfaces a **Бүгд / All figures** badge in this case (same component shape as the solo fallback).
- **Lock at create.** No mid-game roster changes. If the host claims a new card after creating a room, the room's `eligible_fig_ids` does not update.
- **No demo-mode escape hatch for live.** Solo's `?demo=1` exists because solo is a low-friction practice surface; live rooms have join-code overhead and an explicit Start gesture, so a separate demo flag is YAGNI.

## 1. Schema

```sql
alter table game_sessions add column eligible_fig_ids int[] null;
```

Migration file: `supabase/migrations/20260427020000_live_room_eligible_figs.sql` (next slot after today's `20260427010000_orders.sql`).

- Nullable. NULL = "use full FIGURES" (the fallback case).
- Populated only when `mode = 'live_room'`.
- No index needed — column is read once per round build, alongside the existing `seed` / `round_size` reads.
- No RLS change required: the column rides along with existing `game_sessions` SELECT policies.

## 2. Edge function — `game-create-session`

In `supabase/functions/game-create-session/index.ts`, after the existing `live_room` validation block (after `insert.join_code = randJoinCode()`), and before the row insert:

```ts
if (mode === 'live_room') {
  const { data: owned, error: ownedError } = await admin
    .from('card_ownership')
    .select('fig_id')
    .eq('user_id', userId);

  // Fail closed: do not silently fall back to full pool when the trust-boundary
  // roster lookup fails. The client localizes `roster_lookup_failed` and surfaces
  // a recoverable create-room error so the host can retry.
  if (ownedError) {
    return json({ ok: false, reason: 'roster_lookup_failed' }, 503);
  }

  const ownedSet = new Set((owned ?? []).map((r) => r.fig_id));
  const eligible = QUOTE_FIG_IDS.filter((id) => ownedSet.has(id));
  // Intentional fallback: NULL is set only after a successful lookup proves the
  // host has too few quote-bearing owned figures for roster-gated live play.
  insert.eligible_fig_ids = eligible.length >= MIN_FIGS_FOR_ROSTER ? eligible : null;
}
```

`QUOTE_FIG_IDS` is a new exported constant in `supabase/functions/_shared/figures.ts`, computed at module-load time from the existing `FIGURES` array (`FIGURES.filter(f => f.quote).map(f => f.fig_id)`). The shared figure data is already kept in lockstep with the client via `gen-shared-figures.mjs`, so no new sync work.

`MIN_FIGS_FOR_ROSTER = 4`, exported from `_shared/figures.ts`. Mirrors the client constant in `GameQuoteGuess.jsx:19`.

The `select('id, seed, join_code')` clause on the insert is extended to also return `eligible_fig_ids` so the response includes it for the host (the client doesn't strictly need it on the create call — it'll come back via the live snapshot — but it costs nothing to include).

Solo, async_duel, and tournament modes are untouched.

Add `roster_lookup_failed` to the client-side `translateReason` localizer in `src/lib/i18n.jsx` so hosts see a meaningful retryable error message rather than the raw reason code. This distinguishes the failure mode from the intentional fallback in any logging/observability surface — only the explicit 503 path is the error case; NULL `eligible_fig_ids` means the verified-too-few-cards path.

## 3. Client — round-build

`LiveRoomGame.jsx` line 21-24 currently builds the round from raw `FIGURES`. Change:

```jsx
const figurePool = useMemo(() => {
  const ids = room.session?.eligible_fig_ids;
  if (!ids || ids.length === 0) return FIGURES;
  const idSet = new Set(ids);
  return FIGURES.filter((f) => idSet.has(f.fig_id));
}, [room.session?.eligible_fig_ids]);

const round = useMemo(() => {
  if (!room.session?.seed || !room.session?.round_size) return [];
  return buildRoundFromSeed(figurePool, room.session.round_size, room.session.seed);
}, [room.session?.seed, room.session?.round_size, figurePool]);
```

`buildRoundFromSeed` already pulls distractors from its `allFigures` argument (the same arg as the question pool), so passing `figurePool` produces the same "distractors-restricted-to-eligible-pool" behaviour as solo. Consistent with `GameQuoteGuess.jsx:75-78`.

`game-live-snapshot` already returns the full `game_sessions` row (or the relevant subset) to subscribers; verify in step 4 of the implementation plan that `eligible_fig_ids` is included in its select clause and add it if missing.

## 4. Lobby UI — `LiveRoomLobby.jsx`

Add a small badge next to the existing room-settings line (timer / player cap), wired off `room.session.eligible_fig_ids`:

| State | Badge |
|---|---|
| `eligible_fig_ids != null` and length ≥ 4 | "Цуглуулсан дүрсүүд" / "Roster figures" — solid brass border, count appended (e.g. "Roster · 6") |
| `eligible_fig_ids == null` | "Бүгд" / "All figures" — dashed brass border, hover/title explains "Хост 4-өөс цөөн дүрс цуглуулсан" / "Host has fewer than 4 quote-bearing figures" |

Same Tailwind shape as the existing pills in `GameQuoteGuess.jsx:180-198`. No new component file — inline in `LiveRoomLobby.jsx`.

Guests in the lobby see the same badge: it's per-room state, not per-user. No "you own X of Y" overlay in this iteration (out of scope).

## 5. Tests

**Edge function** — the project has no edge-function test harness today (tournaments shipped without one — see memory note). Coverage is therefore manual + indirect via the client tests below. If the server logic warrants direct coverage later, that's a separate workstream. Manual verification cases that must be exercised before shipping:

- **`card_ownership` query failure does NOT fall back to full pool.** Simulate by temporarily revoking the function's `card_ownership` SELECT grant (or pointing at a dropped table in a branch). Expected: edge function responds with HTTP 503 and `body.reason === 'roster_lookup_failed'`; the row is not inserted; client surfaces the localized retry message.
- **Successful lookup with < 4 owned-with-quotes** → row inserted with `eligible_fig_ids = NULL` (verified-too-few-cards intentional fallback path; not the error path).

**`src/lib/gameApi.test.js`** (or new `src/pages/LiveRoomNew.test.jsx` cases) — mock `createSession` to assert the lobby/snapshot path correctly threads `eligible_fig_ids` through to `LiveRoomGame` props. The existing `LiveRoomNew.test.jsx` is the natural home.

**`LiveRoomGame.test.jsx`** — add cases:
- `room.session.eligible_fig_ids = [1, 3, 4, 17]` → round only contains those fig_ids in `q.figId`.
- `room.session.eligible_fig_ids = null` → falls back to full FIGURES (current behaviour, regression check).

**`LiveRoomLobby.test.jsx`** — add cases:
- Roster badge renders with count when `eligible_fig_ids` is non-empty.
- "All figures" badge renders when `eligible_fig_ids` is null.
- Existing tests (Start button, copy/share buttons) still pass.

Vitest baseline at start of work: 185 green. Target: 185 + new cases, all green.

## 6. Out of scope

- Tournaments (decided above — they stay full-pool).
- Mid-game roster updates. `eligible_fig_ids` is locked at session create.
- Demo-mode flag for live rooms. YAGNI.
- "You own X of the room's Y figures" overlay for guests. Nice-to-have, defer.
- Backfilling existing `game_sessions` rows. They predate the column; NULL means "use FIGURES" for legacy rows or for the intentional verified-too-few-cards fallback. NULL is never acceptable as silent recovery from a roster lookup error — that path returns `503 / roster_lookup_failed` instead.

## 7. Files touched (preview)

- `supabase/migrations/20260427020000_live_room_eligible_figs.sql` (new)
- `supabase/functions/_shared/figures.ts` (export `QUOTE_FIG_IDS`, `MIN_FIGS_FOR_ROSTER`)
- `supabase/functions/game-create-session/index.ts`
- `supabase/functions/game-live-snapshot/index.ts` (verify `eligible_fig_ids` in select)
- `src/pages/LiveRoomGame.jsx`
- `src/pages/LiveRoomGame.test.jsx`
- `src/pages/LiveRoomLobby.jsx`
- `src/pages/LiveRoomLobby.test.jsx`
- `src/lib/i18n.jsx` (string pair for "Roster figures / Цуглуулсан дүрсүүд" if not already keyed; new `translateReason` entry for `roster_lookup_failed`)

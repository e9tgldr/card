# Live MP Roster Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constrain a live multiplayer room's question pool to the host's owned-with-quotes figures, with fail-closed enforcement on the server lookup.

**Architecture:** New nullable `int[]` column on `game_sessions` populated by `game-create-session` only for `mode='live_room'`, after a successful `card_ownership` query. Query failure returns `503 / roster_lookup_failed` (not silent fallback). Client filters `FIGURES` against `room.session.eligible_fig_ids` before `buildRoundFromSeed`; NULL means use full `FIGURES` (verified-too-few-cards or legacy row).

**Tech Stack:** Supabase Postgres + Edge Functions (Deno), React + Vite + Vitest, jsdom.

**Spec:** `docs/superpowers/specs/2026-04-27-live-mp-roster-gate-design.md`

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `supabase/migrations/20260427020000_live_room_eligible_figs.sql` | Add `eligible_fig_ids int[]` to `game_sessions` | Create |
| `supabase/functions/_shared/rosterGate.ts` | Export `QUOTE_FIG_IDS`, `MIN_FIGS_FOR_ROSTER` (sibling to figures.ts because the generator wholesale-rewrites figures.ts) | Create |
| `supabase/functions/game-create-session/index.ts` | Compute `eligible_fig_ids` for live rooms; fail-closed on lookup error | Modify |
| `supabase/functions/game-live-snapshot/index.ts` | Include `eligible_fig_ids` in session select | Modify |
| `src/lib/i18n.jsx` | `error.roster_lookup_failed` + roster-badge strings | Modify |
| `src/pages/LiveRoomGame.jsx` | Compute `figurePool` from `room.session.eligible_fig_ids` | Modify |
| `src/pages/LiveRoomGame.test.jsx` | Test roster filtering + null fallback | Modify |
| `src/pages/LiveRoomLobby.jsx` | Render roster / "All figures" badge | Modify |
| `src/pages/LiveRoomLobby.test.jsx` | Test badge variants | Modify |

---

### Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/20260427020000_live_room_eligible_figs.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with `name: 'live_room_eligible_figs'` and the SQL above. The MCP tool is pre-allowed in `.claude/settings.local.json` (see memory: `supabase_mcp_patterns.md`).

- [ ] **Step 3: Verify the column exists**

Use `mcp__supabase__execute_sql` to run:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name='game_sessions' and column_name='eligible_fig_ids';
```
Expected: one row, `data_type='ARRAY'`, `is_nullable='YES'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427020000_live_room_eligible_figs.sql
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(db): eligible_fig_ids column on game_sessions"
```

---

### Task 2: Shared figures constants

**Files:**
- Modify: `supabase/functions/_shared/figures.ts` (append after the `FIGURES` export)

- [ ] **Step 1: Add the exports**

Append to the bottom of `supabase/functions/_shared/figures.ts`:

```ts
// Quote-bearing figures only — used by the live-room roster gate.
// Mirrors src/pages/GameQuoteGuess.jsx:19 (MIN_FIGS_FOR_ROSTER).
export const QUOTE_FIG_IDS: number[] = FIGURES
  .filter((f) => f.quote != null && f.quote !== '')
  .map((f) => f.fig_id);

export const MIN_FIGS_FOR_ROSTER = 4;
```

- [ ] **Step 2: Verify the figure-data sync script doesn't overwrite the appendix**

Read `scripts/gen-shared-figures.mjs` and confirm it only writes the `FIGURES` block (or rewrites the whole file but preserves trailing additions). If it would clobber the appendix, place the constants in a sibling file `supabase/functions/_shared/rosterGate.ts` instead and re-export. Decide before continuing.

Run: `npm run gen:figures`
Expected: clean exit. Re-read the file and confirm `QUOTE_FIG_IDS` is still present.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/figures.ts
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(server): export QUOTE_FIG_IDS + MIN_FIGS_FOR_ROSTER for roster gate"
```

---

### Task 3: `game-create-session` — fail-closed roster lookup

**Files:**
- Modify: `supabase/functions/game-create-session/index.ts`

- [ ] **Step 1: Add the import**

At the top of the file, after the existing imports:

```ts
import { QUOTE_FIG_IDS, MIN_FIGS_FOR_ROSTER } from '../_shared/rosterGate.ts';
```

- [ ] **Step 2: Insert the roster lookup before the row insert**

After the existing `live_room` validation block (the one that sets `insert.timer_s`, `insert.player_cap`, `insert.join_code`) and **before** the `const { data: session, error: insErr } = await admin.from('game_sessions').insert(insert)` line, add:

```ts
  if (mode === 'live_room') {
    const { data: owned, error: ownedError } = await admin
      .from('card_ownership')
      .select('fig_id')
      .eq('user_id', userId);

    // Fail closed: do not silently fall back to full pool when the
    // trust-boundary roster lookup fails. The client localizes
    // `roster_lookup_failed` and surfaces a recoverable create-room error.
    if (ownedError) {
      return json({ ok: false, reason: 'roster_lookup_failed' }, 503);
    }

    const ownedSet = new Set((owned ?? []).map((r) => r.fig_id));
    const eligible = QUOTE_FIG_IDS.filter((id) => ownedSet.has(id));
    insert.eligible_fig_ids =
      eligible.length >= MIN_FIGS_FOR_ROSTER ? eligible : null;
  }
```

- [ ] **Step 3: Deploy via Supabase MCP**

Use `mcp__supabase__deploy_edge_function` with `slug: 'game-create-session'`, body = full `index.ts` contents. Pre-allowed in settings.

- [ ] **Step 4: Manual smoke A — host with ≥4 owned-with-quotes**

In a browser logged in as a user that owns at least 4 fig_ids from `[1, 3, 4, 17, 34, 36, 49]`, hit `/games/quotes/live/new` and create a room. Then via `mcp__supabase__execute_sql`:
```sql
select id, mode, eligible_fig_ids
from game_sessions
where host_user_id='<that user uuid>'
order by created_at desc limit 1;
```
Expected: `mode='live_room'`, `eligible_fig_ids` is an int[] with the host's quote-bearing fig_ids.

- [ ] **Step 5: Manual smoke B — host with <4 owned-with-quotes**

As a fresh user (only the 3-figure starter pack: 1, 3, 14 — only 1, 3 have quotes), create a live room. Query as in Step 4.
Expected: `eligible_fig_ids IS NULL` (verified-too-few-cards fallback).

- [ ] **Step 6: Manual smoke C — solo / async_duel / tournament unaffected**

Create one of each via existing flows (solo via `/games/quotes`, async_duel via "challenge a friend", tournament via `/app/tournaments` admin Publish). Query each:
```sql
select mode, eligible_fig_ids from game_sessions order by created_at desc limit 5;
```
Expected: solo / async_duel / tournament rows have `eligible_fig_ids IS NULL` (column ride-along; never set for non-live modes).

- [ ] **Step 7: Manual smoke D — fail-closed on lookup error**

Temporarily revoke `select` on `card_ownership` for `service_role` via:
```sql
revoke select on public.card_ownership from service_role;
```
Then attempt to create a live room from the browser.
Expected: client surfaces an error toast (raw `roster_lookup_failed` until Task 5 lands the localization). The `game_sessions` table has **no new row** for that attempt.

Restore: `grant select on public.card_ownership to service_role;`

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/game-create-session/index.ts
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(server): fail-closed roster gate in game-create-session"
```

---

### Task 4: `game-live-snapshot` — surface `eligible_fig_ids`

**Files:**
- Modify: `supabase/functions/game-live-snapshot/index.ts:49`

- [ ] **Step 1: Extend the session select clause**

Change line 49 from:

```ts
    .select('id, status, mode, lang, round_size, timer_s, host_user_id, current_round_idx, current_sent_at, current_deadline, rematch_session_id, seed, join_code');
```

to:

```ts
    .select('id, status, mode, lang, round_size, timer_s, host_user_id, current_round_idx, current_sent_at, current_deadline, rematch_session_id, seed, join_code, eligible_fig_ids');
```

- [ ] **Step 2: Deploy via Supabase MCP**

`mcp__supabase__deploy_edge_function` slug `game-live-snapshot`.

- [ ] **Step 3: Manual smoke — snapshot returns the column**

For one of the live rooms created in Task 3 step 4, hit `/games/quotes/live/<code>` in the browser, open devtools, inspect the network response from `game-live-snapshot`. Expected: `session.eligible_fig_ids` is an int[] (or null for the Task 3 step 5 case).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/game-live-snapshot/index.ts
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(server): surface eligible_fig_ids in live-snapshot"
```

---

### Task 5: i18n strings

**Files:**
- Modify: `src/lib/i18n.jsx` (around the existing `error.*` block at line ~196 and the `live.*` block)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/i18n.test.jsx` (or create alongside if absent — check first):

```jsx
import { describe, it, expect } from 'vitest';
import { STRINGS } from '@/lib/i18n';

describe('roster-gate i18n', () => {
  it('has bilingual error.roster_lookup_failed', () => {
    expect(STRINGS['error.roster_lookup_failed']).toBeDefined();
    expect(STRINGS['error.roster_lookup_failed'].mn).toMatch(/.+/);
    expect(STRINGS['error.roster_lookup_failed'].en).toMatch(/.+/);
  });
  it('has bilingual live.lobby.rosterFigures', () => {
    expect(STRINGS['live.lobby.rosterFigures']).toBeDefined();
  });
  it('has bilingual live.lobby.allFigures', () => {
    expect(STRINGS['live.lobby.allFigures']).toBeDefined();
  });
  it('has bilingual live.lobby.allFiguresHint', () => {
    expect(STRINGS['live.lobby.allFiguresHint']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

```bash
npm run test -- i18n
```
Expected: 4 failing assertions, all `Cannot read properties of undefined`.

- [ ] **Step 3: Add the strings**

In `src/lib/i18n.jsx`, append to the `error.*` block (after `error.duplicate_rematch` near line 208):

```jsx
  'error.roster_lookup_failed': {
    mn: 'Цуглуулга шалгахад алдаа гарлаа. Дахин оролдоорой.',
    en: 'Could not check your collection. Please try again.',
  },
```

In the same file, find the `live.lobby.*` cluster (alongside `live.lobby.joinCode`, `live.lobby.start`) and add:

```jsx
  'live.lobby.rosterFigures':   { mn: 'Цуглуулсан дүрсүүд', en: 'Roster figures' },
  'live.lobby.allFigures':      { mn: 'Бүгд',                 en: 'All figures' },
  'live.lobby.allFiguresHint':  {
    mn: 'Хост 4-өөс цөөн ишлэлт дүрс цуглуулсан тул бүх дүрс ашиглана.',
    en: 'Host has fewer than 4 quote-bearing figures, so the full set is in play.',
  },
```

- [ ] **Step 4: Run the test, expect PASS**

```bash
npm run test -- i18n
```
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.jsx src/lib/i18n.test.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(i18n): roster gate strings + roster_lookup_failed reason"
```

---

### Task 6: `LiveRoomGame.jsx` — figurePool from session

**Files:**
- Modify: `src/pages/LiveRoomGame.jsx:21-24`
- Modify: `src/pages/LiveRoomGame.test.jsx`

- [ ] **Step 1: Write the failing test**

Append to `src/pages/LiveRoomGame.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LiveRoomGame from './LiveRoomGame';
import { LangProvider } from '@/lib/i18n';

vi.mock('@/lib/liveRoomApi', () => ({
  submitAnswer: vi.fn(),
  requestRematch: vi.fn(),
  requestNext: vi.fn(),
  requestReveal: vi.fn(),
}));

function makeRoom({ eligible }) {
  return {
    session: {
      id: 'sess-1',
      seed: 'TESTSEED',
      round_size: 5,
      status: 'in_progress',
      host_user_id: 'host-uid',
      current_round_idx: 0,
      eligible_fig_ids: eligible,
    },
    participants: [{ user_id: 'host-uid', current_score: 0, username: 'host' }],
    lastReveal: null,
  };
}

describe('LiveRoomGame roster gate', () => {
  it('restricts question fig_ids to eligible_fig_ids when set', () => {
    const room = makeRoom({ eligible: [1, 3] });
    render(
      <MemoryRouter>
        <LangProvider><LiveRoomGame room={room} sessionId="sess-1" currentUserId="host-uid" /></LangProvider>
      </MemoryRouter>,
    );
    // The question's qattr is the figure's name; only fig_ids 1 (Чингис Хаан)
    // or 3 (Хубилай Хаан) can appear in the prompt area.
    const root = document.body.textContent;
    const hasOnlyEligibleAttribution =
      root.includes('Чингис Хаан') || root.includes('Хубилай Хаан');
    expect(hasOnlyEligibleAttribution).toBe(true);
    // No Mongke (fig_id 4) or Alan Goa (fig_id 17) should be the answer figure
    // in this rendered question — distractors are still pulled from full FIGURES,
    // but the question owner must be one of the eligible 2.
  });

  it('falls back to full FIGURES when eligible_fig_ids is null', () => {
    const room = makeRoom({ eligible: null });
    render(
      <MemoryRouter>
        <LangProvider><LiveRoomGame room={room} sessionId="sess-2" currentUserId="host-uid" /></LangProvider>
      </MemoryRouter>,
    );
    // Component renders without crashing and shows a question.
    expect(document.body.textContent).toMatch(/\?|вэ/);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

```bash
npm run test -- LiveRoomGame
```
Expected: assertions about restricted attribution fail because current code uses raw `FIGURES`. (May also pass accidentally for some seeds; if so, the eligible-restriction test should still fail because seed `TESTSEED` deterministically picks an attribution outside `[1, 3]`. If it does pass, change `eligible: [17]` and assert only "Алан Гоа" appears.)

- [ ] **Step 3: Implement the figure-pool filter**

In `src/pages/LiveRoomGame.jsx`, replace the existing block at lines 21-24:

```jsx
  const round = useMemo(() => {
    if (!room.session?.seed || !room.session?.round_size) return [];
    return buildRoundFromSeed(FIGURES, room.session.round_size, room.session.seed);
  }, [room.session?.seed, room.session?.round_size]);
```

with:

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

- [ ] **Step 4: Run the test, expect PASS**

```bash
npm run test -- LiveRoomGame
```
Expected: all green, including pre-existing tests in this file.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LiveRoomGame.jsx src/pages/LiveRoomGame.test.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(mp): live game round honours session eligible_fig_ids"
```

---

### Task 7: `LiveRoomLobby.jsx` — roster badge

**Files:**
- Modify: `src/pages/LiveRoomLobby.jsx`
- Modify: `src/pages/LiveRoomLobby.test.jsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/pages/LiveRoomLobby.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LiveRoomLobby from './LiveRoomLobby';
import { LangProvider } from '@/lib/i18n';

function makeRoom({ eligible, hostId = 'host-uid' }) {
  return {
    session: {
      id: 'sess-1',
      join_code: 'ABCDEF',
      host_user_id: hostId,
      player_cap: 8,
      status: 'open',
      eligible_fig_ids: eligible,
    },
    participants: [{ user_id: hostId, username: 'host' }],
  };
}

describe('LiveRoomLobby roster badge', () => {
  it('renders the roster-figures badge with count when eligible_fig_ids is non-empty', () => {
    render(
      <LangProvider>
        <LiveRoomLobby room={makeRoom({ eligible: [1, 3, 4, 17, 34, 36] })}
          sessionId="sess-1" currentUserId="host-uid" />
      </LangProvider>,
    );
    expect(screen.getByText(/Roster figures|Цуглуулсан дүрсүүд/)).toBeInTheDocument();
    expect(screen.getByText(/· 6/)).toBeInTheDocument();
  });

  it('renders the All-figures badge when eligible_fig_ids is null', () => {
    render(
      <LangProvider>
        <LiveRoomLobby room={makeRoom({ eligible: null })}
          sessionId="sess-1" currentUserId="host-uid" />
      </LangProvider>,
    );
    expect(screen.getByText(/All figures|Бүгд/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests, expect FAIL**

```bash
npm run test -- LiveRoomLobby
```
Expected: 2 new assertions fail (`Unable to find an element with the text…`).

- [ ] **Step 3: Implement the badge**

In `src/pages/LiveRoomLobby.jsx`, after the existing join-code/buttons row (after the closing `</div>` of the flex row at line 74) and **before** the players block, add:

```jsx
        <RosterBadge eligibleFigIds={room.session?.eligible_fig_ids} t={t} />
```

Then at the bottom of the file (after the default-export function closes), add the helper:

```jsx
function RosterBadge({ eligibleFigIds, t }) {
  if (eligibleFigIds && eligibleFigIds.length > 0) {
    return (
      <span
        className="font-meta text-[10px] tracking-[0.28em] uppercase px-2 py-0.5 rounded inline-block"
        style={{ border: '1px solid rgba(201,168,76,0.6)', color: '#c9a84c' }}
      >
        {t('live.lobby.rosterFigures')} · {eligibleFigIds.length}
      </span>
    );
  }
  return (
    <span
      className="font-meta text-[10px] tracking-[0.28em] uppercase px-2 py-0.5 rounded inline-block opacity-80"
      style={{ border: '1px dashed rgba(201,168,76,0.5)', color: '#c9a84c' }}
      title={t('live.lobby.allFiguresHint')}
    >
      {t('live.lobby.allFigures')}
    </span>
  );
}
```

- [ ] **Step 4: Run the tests, expect PASS**

```bash
npm run test -- LiveRoomLobby
```
Expected: all green, including the existing copy/share/start tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LiveRoomLobby.jsx src/pages/LiveRoomLobby.test.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(mp): roster badge in live-room lobby"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run the full vitest suite**

```bash
npm run test
```
Expected: previous baseline (185) + ~6 new tests (4 i18n + 2 lobby + LiveRoomGame additions) all green. Record the new total.

- [ ] **Step 2: Run the build**

```bash
npm run build
```
Expected: clean. The build runs `check:figures` in prebuild — it must pass.

- [ ] **Step 3: End-to-end live-room smoke**

In two browsers (or one normal + one incognito, two different users):
1. Host (with ≥4 owned-with-quotes) creates a live room at `/games/quotes/live/new`.
2. Both browsers see the **Roster figures · N** badge in the lobby.
3. Guest joins, host clicks Start.
4. Play through the round; verify all question attributions belong to fig_ids in the host's eligible set (cross-check via the snapshot's `eligible_fig_ids`).

Then repeat with a host who has <4 owned-with-quotes:
1. Lobby badge shows **All figures**.
2. Round runs against full FIGURES — questions can attribute any of the 7 quote-bearing fig_ids.

- [ ] **Step 4: Final commit (or skip if nothing to commit)**

If smoke surfaced any tweaks, commit them with a `chore(mp):` prefix. Otherwise this task closes the plan.

---

## Out of scope (do not implement)

- Tournaments. They lock fairness from the tournament row; no `eligible_fig_ids` for them.
- Mid-game roster changes. Locked at session create.
- Demo mode for live rooms. YAGNI.
- "You own X of the room's Y figures" overlay for guests.
- Backfilling existing `game_sessions` rows.

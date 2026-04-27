# Card Identification System — Design

**Date:** 2026-04-27
**Status:** Approved (brainstorm)
**Sub-project:** 1 of 4 (parent decomposition: card system → multiplayer system enhancement → multiplayer UI enhancement → global redesign)

## Goal

Pivot the QR scan flow from "anonymous AI chat with a historical figure" to "login-gated claim that adds the figure to the user's permanent collection, then opens the AI chat (now persistent)". Owned figures form the player's roster for multiplayer (Sub-project 2 consumes this).

## Decisions captured during brainstorm

- **Login-gated scan.** No anonymous path. Users must register/login (existing invite-code + username/password flow) before any scan effect.
- **Figure-design ownership** (not unique-instance). Any user scanning the same physical card adds that figure to their own collection. No first-claim binding, no trading, no per-card serial.
- **Multiplayer roster gate** (lives in Sub-project 2). Only owned figures are playable. Non-owners can use a separate **demo mode** with random figures (XP and ranking only count for owned matches).
- **Starter pack** of 3 default figures granted on first login: Чингис Хаан (`fig_id=1`), Хубилай Хаан (`fig_id=3`), Бөртэ Үжин (`fig_id=14`). Idempotent.
- **Chat persistence in DB** (not local-storage), per (user, figure, language). Survives device changes.

## 1. Routes & flow

Existing routes use `<OtpGate>` to require login; `OtpGate` already redirects unauthed users to `/otp?next=<encoded_path>`. The login page is `OtpLogin` at `/otp`, not `/login`.

| Route | Behavior |
|---|---|
| `/c/:figId` | Wrap in `<OtpGate>`. Unauthed users auto-redirect to `/otp?next=/c/:figId` via existing gate logic. When authed, `ScanChat` calls `claim-card` once on mount (skipped if already in `useOwnedFigures` set), then renders the existing chat UI with persistence enabled. |
| `/otp` | Existing `OtpLogin`. Already accepts `?next=<path>`. **Add behavior:** when `next` matches `^/c/`, show a small line above the form: "Бүртгэгдсэний дараа карт цуглуулгад нэмэгдэнэ." No new query param needed. |
| `/collection` | Existing route (`<OtpGate><MyCollection /></OtpGate>`). Replace `MyCollection` component contents (file renamed to `Collection.jsx`, route updated to import the new file). Grid of owned figures; tap → `/c/:figId`. Empty state CTA: "Карт уншуулаад цуглуулгаа эхлүүл" + "Demo тоглоом руу орох" button → `/games/quotes/live?demo=1` (Sub-project 2 wires the demo flag). |

## 2. Data model

Two new tables and one column addition. SQL migration file: `supabase/migrations/20260427000000_card_ownership.sql`.

### `card_ownership`

```sql
create table card_ownership (
  user_id    uuid not null references accounts(id) on delete cascade,
  fig_id     int  not null,
  scanned_at timestamptz not null default now(),
  primary key (user_id, fig_id)
);
```

- Composite PK enforces idempotent re-scans.
- No FK on `fig_id` — figures are static in `src/lib/figuresData.js`.
- Validation of `fig_id` happens in the `claim-card` edge function against the canonical list.
- RLS:
  - `select` allowed where `user_id = auth.uid()`.
  - `insert`/`update`/`delete` denied for clients. Service role (edge fn) is the only writer.

### `card_chats`

```sql
create table card_chats (
  user_id    uuid        not null references accounts(id) on delete cascade,
  fig_id     int         not null,
  lang       text        not null check (lang in ('mn','en','cn')),
  messages   jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, fig_id, lang)
);
```

- One row per (user, figure, language). Switching language in chat opens a separate row.
- RLS: full CRUD restricted to `user_id = auth.uid()`.
- `messages` shape: `[{ role: 'user' | 'assistant', content: string, ts: number }, ...]`.
- A trigger updates `updated_at` on row change.

### `accounts.starter_granted_at`

```sql
alter table accounts add column starter_granted_at timestamptz;
```

- Tracks one-shot starter-pack grant.

## 3. Edge function: `claim-card`

Path: `supabase/functions/claim-card/index.ts`

- **Input:** `{ fig_id: number }`.
- **Auth:** session JWT required; reject 401 otherwise.
- **Validation:** reject if `fig_id` not in canonical figure list (mirrored constant at top of edge fn).
- **Rate limit:** 30 claims/hour/user via existing `rate_limits` table (key on `user_id` + `'claim-card'`).
- **Logic:**
  ```sql
  insert into card_ownership (user_id, fig_id)
  values ($1, $2)
  on conflict (user_id, fig_id) do nothing
  returning scanned_at;
  ```
- **Response:** `{ owned: true, newly_claimed: <bool>, scanned_at: <iso> }`.

## 4. Edge function: `grant-starter-pack`

Path: `supabase/functions/grant-starter-pack/index.ts`

- **Trigger:** called from client after successful `login()` / `registerWithCode()`.
- **Auth:** session JWT required.
- **Logic:**
  - If `accounts.starter_granted_at IS NOT NULL` → return `{ granted: false, reason: 'already_granted' }`.
  - Else: `insert into card_ownership (user_id, fig_id) values ($u,1),($u,3),($u,14) on conflict do nothing;` then `update accounts set starter_granted_at = now() where id = $u;`.
  - Return `{ granted: true, fig_ids: [1,3,14] }`.
- Idempotent.

## 5. Collection page

Component: `src/pages/Collection.jsx` (rename from `MyCollection.jsx` if simpler; otherwise replace contents).

- Query: `select fig_id, scanned_at from card_ownership where user_id = $u order by scanned_at desc;`
- Join client-side against `FIGURES` from `figuresData.js`.
- Layout: 2-col grid on mobile (`grid-cols-2`), 4-col on desktop (`md:grid-cols-4`).
- Each cell: `ico` (large), `card` (small label, e.g., "Хааны Туз"), `name` (bold), `scanned_at` (relative date).
- Tap → navigate `/c/:figId`. Already-owned figures bypass the claim call (component checks ownership before calling edge fn).
- Empty state: centered message + two CTAs:
  - Primary: "Карт уншуулаад цуглуулгаа эхлүүл" (info text only, no action).
  - Secondary: "Demo тоглоом руу орох" → `/games/quotes/live?demo=1`.

## 6. Chat persistence

Hook: `src/hooks/useFigureChat.js`

- Signature change: `useFigureChat(figure, { userId, owned })`.
- On mount/lang-switch, if `owned`:
  - `select messages from card_chats where (user_id, fig_id, lang) = ($u, $f, $l);`
  - Hydrate state with messages (or `[]` if no row).
- On every `send()` round-trip completion: debounced 500ms upsert:
  ```sql
  insert into card_chats (user_id, fig_id, lang, messages)
  values ($u, $f, $l, $m::jsonb)
  on conflict (user_id, fig_id, lang)
  do update set messages = excluded.messages, updated_at = now();
  ```
- If `!owned`: in-memory only (preserves current behavior; relevant if any non-collection chat surface remains, e.g., demo previews).

## 7. Hand-off to Sub-project 2

New hook: `src/hooks/useOwnedFigures.js`

- Returns `{ figIds: number[], loading: boolean, error: Error | null }`.
- Initial fetch: `select fig_id from card_ownership where user_id = $u;`.
- Realtime subscription on `card_ownership` filtered by `user_id` — appends `fig_id` to local state on insert (so a fresh scan is reflected without page reload).
- Sub-project 2 consumes this for the multiplayer roster gate. This sub-project ships the hook with one consumer (the empty-state badge on `/collection` showing "X / 90 figures collected") to validate it.

## 8. Backwards compatibility

- Anonymous `/c/:figId` flow is removed. No data to migrate (no persistent state existed in the anonymous path).
- Existing `rate_limits` table is reused; the AI-chat edge function transitions from IP-keyed to user-keyed rate limits (drop-in change since users are now always authed when reaching chat).
- `voice-cache` storage bucket and ElevenLabs flow unchanged.
- `/collection` route is unchanged at the router level; only the component (`MyCollection.jsx` → `Collection.jsx`) is replaced. No external-link redirect needed.

## 9. Testing

### Vitest unit
- `claim-card`: rejects unauthed; rejects bad `fig_id`; idempotent on duplicate; honors rate limit (31st call/hour returns 429).
- `grant-starter-pack`: grants 3 figures + sets timestamp on first call; no-ops on second.
- `useOwnedFigures`: returns initial fetch correctly; appends on Realtime insert event.
- `useFigureChat`: hydrates from DB when `owned=true`; writes debounced upsert on send; in-memory only when `owned=false`.
- `Collection`: empty state renders both CTAs; populated state renders correct count and grid; tap navigates to `/c/:figId`.
- `ScanChat`: redirects to `/otp?next=%2Fc%2F123` when unauthed (via `OtpGate`); calls `claim-card` exactly once on mount when authed; skips claim call when already in the owned set; `OtpLogin` shows the "claim hint" line when `next` starts with `/c/`.

### Integration
- Full E2E: visit `/c/1` unauth → land on `/login` → register → redirected back → `/c/1` shows chat → reload → chat history preserved → navigate to `/collection` → see all 4 figures (3 starter + 1 scanned).

## 10. Risks & open questions

- **Starter pack edge fn timing.** Calling `grant-starter-pack` immediately after `login()` adds latency. Acceptable trade for simplicity. If felt slow in practice, move to a Postgres trigger on `accounts insert`.
- **`fig_id` constant duplication.** The canonical figure list lives in `figuresData.js` (client). The edge fn needs to validate `fig_id` against it. Plan: a generated JSON file in `supabase/functions/_shared/figure-ids.json` produced by a small `scripts/sync-figure-ids.js` step, kept in sync via a CI check or manual script call. Alternative considered: a `figures` table in DB (rejected — duplicates static data and adds migration burden for content tweaks).
- **Chat history size.** `messages` is unbounded JSONB. Realistic ceiling per (user, figure, lang): ~few hundred messages = ~100KB. Acceptable. If we ever cross 1MB per row, introduce a separate `card_chat_messages` table.

## 11. Out of scope (deferred to other sub-projects)

- Multiplayer roster gate logic — Sub-project 2.
- Demo-mode multiplayer matchmaking and XP/ranking gating — Sub-project 2.
- Any visual redesign — Sub-project 4.
- New multiplayer UI surfaces — Sub-project 3.
- Card trading, gifting, rarity tiers — explicitly deferred (decided against in brainstorm).

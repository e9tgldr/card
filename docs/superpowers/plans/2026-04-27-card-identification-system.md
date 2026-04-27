# Card Identification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the QR scan flow at `/c/:figId` from anonymous AI chat to login-gated card claim with a persistent collection and per-card chat history. Land a `useOwnedFigures()` hook that the next sub-project (multiplayer roster gate) will consume.

**Architecture:** Two new Postgres tables (`card_ownership`, `card_chats`) + one column (`profiles.starter_granted_at`); two new edge functions (`claim-card`, `grant-starter-pack`); one new hook (`useOwnedFigures`); modifications to `useFigureChat` (DB persistence when owned), `ScanChat` (claim on mount), `OtpLogin` (claim hint), `App.jsx` (gate `/c/:figId`), and `authStore.js` (call starter-pack post-auth). The collection page (`MyCollection.jsx`) is replaced by `Collection.jsx` rendering owned figures.

**Tech Stack:** React 18, React Router v6, Supabase (Postgres + Edge Functions on Deno), `@tanstack/react-query` for collection queries, Vitest + React Testing Library for unit tests.

**Spec:** `docs/superpowers/specs/2026-04-27-card-identification-system-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/20260427000000_card_ownership.sql` — schema + RLS + trigger
- `supabase/functions/claim-card/index.ts` — POST { fig_id } → idempotent insert
- `supabase/functions/grant-starter-pack/index.ts` — one-shot 3-figure grant
- `src/hooks/useOwnedFigures.js` — fetch + Realtime subscription
- `src/hooks/useOwnedFigures.test.jsx`
- `src/pages/Collection.jsx` — replaces MyCollection content
- `src/pages/Collection.test.jsx`

**Modified files:**
- `src/hooks/useFigureChat.js` — accept `{ userId, owned }`, DB persistence path
- `src/hooks/useFigureChat.test.jsx` (new test file alongside existing hook)
- `src/pages/ScanChat.jsx` — claim-card on mount, pass owned/userId to hook
- `src/pages/ScanChat.test.jsx` — extend with new behavior
- `src/pages/OtpLogin.jsx` — claim hint when next starts with `/c/`
- `src/pages/OtpLogin.test.jsx` — extend
- `src/lib/authStore.js` — call grant-starter-pack post register/login
- `src/App.jsx` — wrap `/c/:figId` in `<OtpGate>`, swap `MyCollection` import for `Collection`

**Deleted files:**
- `src/pages/MyCollection.jsx` (replaced)
- `src/pages/MyCollection.test.jsx` (replaced)

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260427000000_card_ownership.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260427000000_card_ownership.sql`:

```sql
-- Card identification system: per-user ownership records and persistent chats.

create table card_ownership (
  user_id    uuid not null references auth.users(id) on delete cascade,
  fig_id     int  not null,
  scanned_at timestamptz not null default now(),
  primary key (user_id, fig_id)
);

alter table card_ownership enable row level security;

create policy "card_ownership self read"
  on card_ownership for select
  using (user_id = auth.uid());
-- No client insert/update/delete policies: only service role (edge fn) writes.

create table card_chats (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  fig_id     int         not null,
  messages   jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, fig_id)
);

alter table card_chats enable row level security;

create policy "card_chats self read"
  on card_chats for select using (user_id = auth.uid());
create policy "card_chats self insert"
  on card_chats for insert with check (user_id = auth.uid());
create policy "card_chats self update"
  on card_chats for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function set_card_chats_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger card_chats_updated before update on card_chats
  for each row execute function set_card_chats_updated_at();

alter table profiles add column starter_granted_at timestamptz;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool with name `card_ownership` and the SQL above. (Memory: do not REVOKE columns; the migration is permission-clean.)

Expected result: tool returns success.

- [ ] **Step 3: Verify schema with execute_sql**

Run:
```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('card_ownership','card_chats');
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' and column_name = 'starter_granted_at';
```

Expected: `card_ownership` and `card_chats` both present; `starter_granted_at` present on `profiles`.

- [ ] **Step 4: Verify RLS denies anonymous insert**

Run (with anon key):
```sql
insert into card_ownership (user_id, fig_id) values ('00000000-0000-0000-0000-000000000000', 1);
```
Expected: error `new row violates row-level security policy`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260427000000_card_ownership.sql
git commit -m "feat(cards): add card_ownership, card_chats, profiles.starter_granted_at"
```

---

## Task 2: Edge function — claim-card

**Files:**
- Create: `supabase/functions/claim-card/index.ts`

- [ ] **Step 1: Write the edge function**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { FIGURES } from '../_shared/figures.ts';
import { currentHourBucket } from '../_shared/ip.ts';
import { checkAndIncrement } from '../_shared/rate-limit.ts';

const HOURLY_LIMIT = 30;
const VALID_FIG_IDS = new Set(FIGURES.map((f) => f.fig_id));

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, reason: 'unauthenticated' }, 401);
  }

  let body: { fig_id?: number };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const figId = Number(body.fig_id);
  if (!Number.isInteger(figId) || !VALID_FIG_IDS.has(figId)) {
    return json({ ok: false, reason: 'invalid_fig_id' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Resolve the user from their JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ ok: false, reason: 'unauthenticated' }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  // Rate limit keyed on user_id (reusing the rate_limits table; ip_hash column carries user id here).
  const limit = await checkAndIncrement(admin, userId, currentHourBucket(), 'claim-card', HOURLY_LIMIT);
  if (!limit.allowed) {
    return json({ ok: false, reason: 'rate_limited' }, 429);
  }

  const { data: existing, error: selErr } = await admin
    .from('card_ownership')
    .select('scanned_at')
    .eq('user_id', userId)
    .eq('fig_id', figId)
    .maybeSingle();
  if (selErr) return json({ ok: false, reason: 'db_error' }, 500);

  if (existing) {
    return json({ ok: true, owned: true, newly_claimed: false, scanned_at: existing.scanned_at });
  }

  const { data: inserted, error: insErr } = await admin
    .from('card_ownership')
    .insert({ user_id: userId, fig_id: figId })
    .select('scanned_at')
    .single();
  if (insErr) return json({ ok: false, reason: 'db_error' }, 500);

  return json({ ok: true, owned: true, newly_claimed: true, scanned_at: inserted.scanned_at });
});
```

- [ ] **Step 2: Deploy the edge function**

Use Supabase MCP `deploy_edge_function` with `name: "claim-card"` and the file body above. (Memory: deploy with the canonical shape; figures.ts is auto-bundled via `_shared`.)

Expected: tool returns success with deployed function URL.

- [ ] **Step 3: Verify rejects unauthed**

Use Supabase MCP `execute_sql` is not appropriate here — instead, hit the deployed URL via curl from a separate shell:

```bash
curl -X POST "$(supabase functions URL)/claim-card" -H "Content-Type: application/json" -d '{"fig_id":1}'
```

Expected: `{"ok":false,"reason":"unauthenticated"}` and HTTP 401.

(If curl is not available locally, defer this verification to the integration test in Task 11.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/claim-card/index.ts
git commit -m "feat(cards): claim-card edge function with auth, validation, rate-limit"
```

---

## Task 3: Edge function — grant-starter-pack

**Files:**
- Create: `supabase/functions/grant-starter-pack/index.ts`

- [ ] **Step 1: Write the edge function**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

const STARTER_FIG_IDS = [1, 3, 14] as const;

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, reason: 'unauthenticated' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ ok: false, reason: 'unauthenticated' }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('starter_granted_at')
    .eq('id', userId)
    .maybeSingle();
  if (profErr) return json({ ok: false, reason: 'db_error' }, 500);

  if (profile?.starter_granted_at) {
    return json({ ok: true, granted: false, reason: 'already_granted' });
  }

  const rows = STARTER_FIG_IDS.map((fig_id) => ({ user_id: userId, fig_id }));
  const { error: insErr } = await admin
    .from('card_ownership')
    .upsert(rows, { onConflict: 'user_id,fig_id', ignoreDuplicates: true });
  if (insErr) return json({ ok: false, reason: 'db_error' }, 500);

  const { error: updErr } = await admin
    .from('profiles')
    .update({ starter_granted_at: new Date().toISOString() })
    .eq('id', userId);
  if (updErr) return json({ ok: false, reason: 'db_error' }, 500);

  return json({ ok: true, granted: true, fig_ids: STARTER_FIG_IDS });
});
```

- [ ] **Step 2: Deploy**

Use Supabase MCP `deploy_edge_function` with `name: "grant-starter-pack"` and the file body.

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/grant-starter-pack/index.ts
git commit -m "feat(cards): grant-starter-pack edge function (idempotent 3-figure starter)"
```

---

## Task 4: useOwnedFigures hook

**Files:**
- Create: `src/hooks/useOwnedFigures.js`
- Test: `src/hooks/useOwnedFigures.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useOwnedFigures.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOwnedFigures } from '@/hooks/useOwnedFigures';

const mockFrom = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();
const subscribeCallbacks = [];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockChannel.mockReset();
  mockRemoveChannel.mockReset();
  subscribeCallbacks.length = 0;
  mockChannel.mockImplementation(() => {
    const ch = {
      on: vi.fn().mockImplementation((_evt, _filter, cb) => {
        subscribeCallbacks.push(cb);
        return ch;
      }),
      subscribe: vi.fn().mockReturnValue(ch),
    };
    return ch;
  });
});

describe('useOwnedFigures', () => {
  it('returns figIds from initial fetch', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [{ fig_id: 1 }, { fig_id: 3 }, { fig_id: 14 }],
          error: null,
        }),
      }),
    });

    const { result } = renderHook(() => useOwnedFigures('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.figIds).toEqual([1, 3, 14]);
    expect(result.current.error).toBeNull();
  });

  it('appends figIds when Realtime delivers an INSERT', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ fig_id: 1 }], error: null }),
      }),
    });
    const { result } = renderHook(() => useOwnedFigures('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.figIds).toEqual([1]);

    act(() => {
      subscribeCallbacks[0]({ new: { fig_id: 7, user_id: 'user-1' } });
    });
    expect(result.current.figIds).toEqual([1, 7]);
  });

  it('returns empty array and error on fetch failure', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('boom') }),
      }),
    });
    const { result } = renderHook(() => useOwnedFigures('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.figIds).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('returns empty figIds without fetching when userId is null', async () => {
    const { result } = renderHook(() => useOwnedFigures(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.figIds).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useOwnedFigures.test.jsx`
Expected: FAIL — file `useOwnedFigures` not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useOwnedFigures.js`:

```javascript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useOwnedFigures(userId) {
  const [figIds, setFigIds] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setFigIds([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('card_ownership')
      .select('fig_id')
      .eq('user_id', userId)
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr);
          setFigIds([]);
        } else {
          setError(null);
          setFigIds((data ?? []).map((r) => r.fig_id));
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`card_ownership:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'card_ownership', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newFigId = payload?.new?.fig_id;
          if (typeof newFigId !== 'number') return;
          setFigIds((prev) => (prev.includes(newFigId) ? prev : [...prev, newFigId]));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { figIds, loading, error };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useOwnedFigures.test.jsx`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOwnedFigures.js src/hooks/useOwnedFigures.test.jsx
git commit -m "feat(cards): useOwnedFigures hook with Realtime updates"
```

---

## Task 5: useFigureChat — DB persistence path

**Files:**
- Modify: `src/hooks/useFigureChat.js`
- Test: `src/hooks/useFigureChat.test.jsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useFigureChat.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFigureChat } from '@/hooks/useFigureChat';

const mockFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    functions: { invoke: (...args) => mockInvoke(...args) },
  },
}));

vi.mock('@/lib/figureResponder', () => ({
  tryAnswer: () => null,
}));

const figure = {
  fig_id: 1, name: 'Чингис Хаан', yrs: '1162–1227',
  role: 'r', bio: 'b', achs: [], fact: 'f', quote: 'q', qattr: 'a',
};

beforeEach(() => {
  mockFrom.mockReset();
  mockInvoke.mockReset();
  sessionStorage.clear();
});
afterEach(() => { vi.useRealTimers(); });

function chatRowQuery(messages) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: messages ? { messages } : null,
            error: null,
          }),
        }),
      }),
    }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

describe('useFigureChat — owned mode', () => {
  it('hydrates messages from card_chats when owned and userId present', async () => {
    const stored = [
      { role: 'user', text: 'hi', lang: 'mn', ts: 1 },
      { role: 'ai', text: 'sain uu', lang: 'mn', ts: 2 },
    ];
    const q = chatRowQuery(stored);
    mockFrom.mockReturnValue(q);

    const { result } = renderHook(() =>
      useFigureChat(figure, { userId: 'u1', owned: true }),
    );
    await waitFor(() => expect(result.current.messages).toEqual(stored));
  });

  it('writes upsert to card_chats after a send (debounced)', async () => {
    vi.useFakeTimers();
    const q = chatRowQuery(null);
    mockFrom.mockReturnValue(q);
    mockInvoke.mockResolvedValue({ data: { ok: true, reply: 'r', source: 'edge' }, error: null });

    const { result } = renderHook(() =>
      useFigureChat(figure, { userId: 'u1', owned: true }),
    );
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.send('hi'); });
    await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve(); });

    expect(q.upsert).toHaveBeenCalled();
    const upsertArgs = q.upsert.mock.calls[q.upsert.mock.calls.length - 1][0];
    expect(upsertArgs.user_id).toBe('u1');
    expect(upsertArgs.fig_id).toBe(1);
    expect(Array.isArray(upsertArgs.messages)).toBe(true);
  });
});

describe('useFigureChat — anonymous fallback', () => {
  it('uses sessionStorage when owned=false', async () => {
    const { result } = renderHook(() => useFigureChat(figure, { userId: null, owned: false }));
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    expect(mockFrom).not.toHaveBeenCalled();
    const stored = sessionStorage.getItem('figureChat:1');
    expect(stored).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useFigureChat.test.jsx`
Expected: FAIL — `useFigureChat` does not yet accept `{ userId, owned }`.

- [ ] **Step 3: Modify the hook**

Replace `src/hooks/useFigureChat.js` with the version below. Key changes vs. existing:
- Accept second arg `{ userId, owned } = {}`.
- New ref `dbReady` and `pendingWriteRef` (debounce timer).
- On mount: if `owned && userId`, fetch from `card_chats`; otherwise use existing `sessionStorage` path.
- New helper `scheduleDbWrite` invoked from inside `pushMessage` when DB mode is active; cancels prior timer; upserts after 500ms.

```javascript
import { useState, useEffect, useCallback, useRef } from 'react';
import { tryAnswer } from '@/lib/figureResponder';
import { supabase } from '@/lib/supabase';

const MAX_TURNS_KEPT = 50;
const MAX_TURNS_SENT_TO_LLM = 8;
const DB_WRITE_DEBOUNCE_MS = 500;

const OPENING = {
  mn: (name) => `Сайн уу. Би ${name} байна. Юу мэдмээр байна?`,
  en: (name) => `Greetings. I am ${name}. What would you like to know?`,
  cn: (name) => `你好。我是${name}。你想知道什么？`,
};

const UPSTREAM_FALLBACK = {
  mn: 'Уучлаарай, миний бодол санаа одоо тогтворгүй байна. Дараа дахин асуугаарай.',
  en: 'Forgive me — my thoughts are unsettled right now. Ask me again later.',
  cn: '抱歉，此刻我的思绪不宁。请稍后再问。',
};
const RATE_LIMITED_FALLBACK = UPSTREAM_FALLBACK;

const storageKey = (figId) => `figureChat:${figId}`;
function loadStored(figId) {
  try { return JSON.parse(sessionStorage.getItem(storageKey(figId)) || 'null'); }
  catch { return null; }
}
function saveStored(figId, data) {
  try { sessionStorage.setItem(storageKey(figId), JSON.stringify(data)); }
  catch { /* quota full, ignore */ }
}

export function useFigureChat(figure, { userId, owned } = {}) {
  const [messages, setMessages] = useState([]);
  const [lang, setLang] = useState('mn');
  const [busy, setBusy] = useState(false);
  const initialised = useRef(false);
  const dbWriteTimer = useRef(null);
  const useDb = Boolean(owned && userId);

  // Mount: load history (DB if owned, else sessionStorage), or seed greeting.
  useEffect(() => {
    if (!figure || initialised.current) return;
    initialised.current = true;

    let cancelled = false;
    async function load() {
      if (useDb) {
        const { data } = await supabase
          .from('card_chats')
          .select('messages')
          .eq('user_id', userId)
          .eq('fig_id', figure.fig_id)
          .maybeSingle();
        if (cancelled) return;
        const stored = data?.messages;
        if (Array.isArray(stored) && stored.length > 0) {
          setMessages(stored);
          const last = stored[stored.length - 1];
          if (last?.lang) setLang(last.lang);
          return;
        }
      } else {
        const stored = loadStored(figure.fig_id);
        if (stored) {
          setMessages(stored.messages);
          setLang(stored.lang ?? 'mn');
          return;
        }
      }
      const opening = { role: 'ai', text: OPENING.mn(figure.name), lang: 'mn', ts: Date.now() };
      setMessages([opening]);
      if (useDb) scheduleDbWrite([opening]);
      else saveStored(figure.fig_id, { messages: [opening], lang: 'mn' });
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figure, useDb, userId]);

  const scheduleDbWrite = useCallback((nextMessages) => {
    if (!useDb) return;
    if (dbWriteTimer.current) clearTimeout(dbWriteTimer.current);
    dbWriteTimer.current = setTimeout(async () => {
      await supabase
        .from('card_chats')
        .upsert(
          { user_id: userId, fig_id: figure.fig_id, messages: nextMessages },
          { onConflict: 'user_id,fig_id' },
        );
    }, DB_WRITE_DEBOUNCE_MS);
  }, [useDb, userId, figure]);

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => {
      const next = [...prev, msg].slice(-MAX_TURNS_KEPT);
      if (useDb) scheduleDbWrite(next);
      else saveStored(figure.fig_id, { messages: next, lang });
      return next;
    });
  }, [figure, lang, useDb, scheduleDbWrite]);

  const switchLang = useCallback((newLang) => {
    setLang(newLang);
    pushMessage({ role: 'ai', text: OPENING[newLang](figure.name), lang: newLang, ts: Date.now() });
  }, [figure, pushMessage]);

  const send = useCallback(async (text) => {
    if (!text?.trim() || busy) return;
    const userMsg = { role: 'user', text: text.trim(), lang, ts: Date.now() };
    pushMessage(userMsg);
    setBusy(true);

    const ruleAnswer = tryAnswer(figure, userMsg.text, lang);
    if (ruleAnswer) {
      pushMessage({ role: 'ai', text: ruleAnswer, lang, source: 'rule', ts: Date.now() });
      setBusy(false);
      return;
    }

    try {
      const history = messages.slice(-MAX_TURNS_SENT_TO_LLM).map((m) => ({ role: m.role, text: m.text }));
      const { data, error } = await supabase.functions.invoke('ask-figure', {
        body: {
          figure: {
            name: figure.name, yrs: figure.yrs, role: figure.role, bio: figure.bio,
            achs: figure.achs, fact: figure.fact, quote: figure.quote, qattr: figure.qattr,
          },
          question: userMsg.text, lang, history,
        },
      });
      const replyText = (!error && data?.ok && data.reply) ? data.reply : UPSTREAM_FALLBACK[lang];
      pushMessage({ role: 'ai', text: replyText, lang, source: data?.source ?? 'error', ts: Date.now() });
    } catch (err) {
      console.error('ask-figure invoke failed', err);
      pushMessage({ role: 'ai', text: UPSTREAM_FALLBACK[lang], lang, source: 'exception', ts: Date.now() });
    }
    setBusy(false);
  }, [figure, lang, busy, pushMessage, messages]);

  const clearChat = useCallback(() => {
    sessionStorage.removeItem(storageKey(figure.fig_id));
    initialised.current = false;
    setMessages([]);
  }, [figure]);

  return { messages, lang, busy, send, switchLang, clearChat };
}

export const __internals = { MAX_TURNS_SENT_TO_LLM, UPSTREAM_FALLBACK, RATE_LIMITED_FALLBACK };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useFigureChat.test.jsx`
Expected: 3/3 PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all existing tests still pass; specifically `ScanChat.test.jsx` may need an update if it asserts hook signature — fix in Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFigureChat.js src/hooks/useFigureChat.test.jsx
git commit -m "feat(cards): useFigureChat DB persistence when owned"
```

---

## Task 6: Auth wiring — call grant-starter-pack

**Files:**
- Modify: `src/lib/authStore.js`

- [ ] **Step 1: Read the current authStore to find login + registerWithCode**

Run: open `src/lib/authStore.js`. Locate `registerWithCode` (line ~73) and `login` (line ~93).

- [ ] **Step 2: Write the failing test**

Append to (or create new) `src/lib/authStore.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a) => mockSignIn(...a),
      signUp: (...a) => mockSignUp(...a),
      getSession: () => mockGetSession(),
    },
    functions: { invoke: (...a) => mockInvoke(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

beforeEach(() => {
  mockInvoke.mockReset();
  mockSignIn.mockReset();
  mockSignUp.mockReset();
  mockGetSession.mockReset();
});

describe('authStore.login', () => {
  it('invokes grant-starter-pack after successful login', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'u1' }, session: { access_token: 't' } }, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, granted: true }, error: null });
    const { login } = await import('@/lib/authStore');
    const res = await login({ username: 'a', password: 'b' });
    expect(res.ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('grant-starter-pack', expect.anything());
  });

  it('does not invoke grant-starter-pack when login fails', async () => {
    mockSignIn.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const { login } = await import('@/lib/authStore');
    await login({ username: 'a', password: 'b' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/authStore.test.js`
Expected: FAIL — `grant-starter-pack` is not invoked.

- [ ] **Step 4: Modify authStore.js**

After the lines that resolve the session in `login` (success path), add:

```javascript
// Grant the starter pack on first login (idempotent on the server side).
try {
  await supabase.functions.invoke('grant-starter-pack', { body: {} });
} catch (err) {
  console.warn('grant-starter-pack invoke failed (will retry next login)', err);
}
```

Apply the same block to the success path of `registerWithCode`. Both calls happen *after* the session is established so the JWT is included via `supabase.functions.invoke` defaults.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/lib/authStore.test.js`
Expected: 2/2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/authStore.js src/lib/authStore.test.js
git commit -m "feat(cards): authStore invokes grant-starter-pack post-login"
```

---

## Task 7: ScanChat — claim on mount

**Files:**
- Modify: `src/pages/ScanChat.jsx`
- Modify: `src/pages/ScanChat.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Wrap /c/:figId route in OtpGate**

Edit `src/App.jsx` line 59:

Old:
```jsx
<Route path="/c/:figId" element={<ScanChat />} />
```

New:
```jsx
<Route path="/c/:figId" element={<OtpGate><ScanChat /></OtpGate>} />
```

- [ ] **Step 2: Write the failing test**

Replace contents of `src/pages/ScanChat.test.jsx` (or extend) with:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ScanChat from '@/pages/ScanChat';

const mockInvoke = vi.fn();
const mockUseOwnedFigures = vi.fn();
const mockUseFigureChat = vi.fn();
const mockSession = { user: { id: 'u1' } };

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a) => mockInvoke(...a) } },
}));
vi.mock('@/hooks/useOwnedFigures', () => ({ useOwnedFigures: (...a) => mockUseOwnedFigures(...a) }));
vi.mock('@/hooks/useFigureChat', () => ({ useFigureChat: (...a) => mockUseFigureChat(...a) }));
vi.mock('@/lib/authStore', () => ({ currentSession: () => mockSession }));

beforeEach(() => {
  mockInvoke.mockReset();
  mockUseOwnedFigures.mockReset();
  mockUseFigureChat.mockReset();
  mockUseFigureChat.mockReturnValue({
    messages: [], lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
  });
});

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/c/:figId" element={<ScanChat />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScanChat — claim flow', () => {
  it('calls claim-card once on mount when figure is not owned', async () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [], loading: false, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, owned: true, newly_claimed: true }, error: null });
    renderAt('/c/1');
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1));
    expect(mockInvoke).toHaveBeenCalledWith('claim-card', { body: { fig_id: 1 } });
  });

  it('does not call claim-card when figure already owned', async () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [1], loading: false, error: null });
    renderAt('/c/1');
    await waitFor(() =>
      expect(mockUseFigureChat).toHaveBeenCalledWith(
        expect.objectContaining({ fig_id: 1 }),
        expect.objectContaining({ userId: 'u1', owned: true }),
      ),
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('passes owned=true to useFigureChat after a fresh claim succeeds', async () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [], loading: false, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, owned: true, newly_claimed: true }, error: null });
    renderAt('/c/1');
    await waitFor(() => {
      const lastCallOpts = mockUseFigureChat.mock.calls[mockUseFigureChat.mock.calls.length - 1][1];
      expect(lastCallOpts).toEqual({ userId: 'u1', owned: true });
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/pages/ScanChat.test.jsx`
Expected: FAIL — claim-card not invoked.

- [ ] **Step 4: Modify ScanChat.jsx**

Replace the body of `ScanChatInner` and add claim-on-mount. Updated component:

```jsx
import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Volume2, X, ArrowLeft } from 'lucide-react';
import { FIGURES } from '@/lib/figuresData';
import { useFigureChat } from '@/hooks/useFigureChat';
import { useOwnedFigures } from '@/hooks/useOwnedFigures';
import { currentSession } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import ScanNotFound from '@/components/ScanNotFound';
import { ErrorBoundary } from '@/lib/feedback';

// (existing LANG_LABELS / LANG_ARIA / AI_THINKING / DISMISS_LABELS unchanged — keep them.)

export default function ScanChat() {
  const { figId } = useParams();
  const figure = FIGURES.find((f) => String(f.fig_id) === String(figId));
  if (!figure) return <ScanNotFound />;
  return <ScanChatInner figure={figure} />;
}

function ScanChatInner({ figure }) {
  const navigate = useNavigate();
  const session = currentSession();
  const userId = session?.user?.id ?? null;
  const { figIds } = useOwnedFigures(userId);
  const owned = figIds.includes(figure.fig_id);
  const [claimed, setClaimed] = useState(false);
  const claimAttempted = useRef(false);

  // Idempotent claim on mount when not yet owned.
  useEffect(() => {
    if (!userId || owned || claimAttempted.current) return;
    claimAttempted.current = true;
    supabase.functions.invoke('claim-card', { body: { fig_id: figure.fig_id } })
      .then(({ data, error }) => {
        if (!error && data?.ok && data.owned) setClaimed(true);
      })
      .catch((err) => console.warn('claim-card failed', err));
  }, [userId, owned, figure.fig_id]);

  const isOwnedForChat = owned || claimed;
  const { messages, lang, busy, send, switchLang } = useFigureChat(figure, { userId, owned: isOwnedForChat });

  // (existing render JSX unchanged — keep as-is.)
}
```

Keep all other lines (JSX render, handleSend, scroll refs) exactly as they were.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/pages/ScanChat.test.jsx`
Expected: 3/3 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ScanChat.jsx src/pages/ScanChat.test.jsx src/App.jsx
git commit -m "feat(cards): ScanChat claims card on mount, gates /c/:figId via OtpGate"
```

---

## Task 8: OtpLogin — claim hint

**Files:**
- Modify: `src/pages/OtpLogin.jsx`
- Modify: `src/pages/OtpLogin.test.jsx`

- [ ] **Step 1: Write the failing test**

Add to `src/pages/OtpLogin.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OtpLogin from '@/pages/OtpLogin';

describe('OtpLogin — claim hint', () => {
  it('shows the claim hint when next param starts with /c/', () => {
    render(
      <MemoryRouter initialEntries={['/otp?next=%2Fc%2F1']}>
        <OtpLogin />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Бүртгэгдсэний дараа карт/i)).toBeInTheDocument();
  });

  it('does not show the claim hint without the next param', () => {
    render(
      <MemoryRouter initialEntries={['/otp']}>
        <OtpLogin />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Бүртгэгдсэний дараа карт/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/OtpLogin.test.jsx`
Expected: FAIL — hint text not present.

- [ ] **Step 3: Modify OtpLogin.jsx**

In the component body, after `useSearchParams` is read, derive:

```jsx
const next = searchParams.get('next') ?? '';
const isClaimFlow = next.startsWith('/c/');
```

Inside the form panel JSX, immediately above the existing form fields, render:

```jsx
{isClaimFlow && (
  <p className="mb-3 text-sm text-brass">
    Бүртгэгдсэний дараа карт цуглуулгад нэмэгдэнэ.
  </p>
)}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/pages/OtpLogin.test.jsx`
Expected: previous tests + 2 new = all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/OtpLogin.jsx src/pages/OtpLogin.test.jsx
git commit -m "feat(cards): OtpLogin shows claim hint when next is /c/:figId"
```

---

## Task 9: Collection page (replaces MyCollection)

**Files:**
- Create: `src/pages/Collection.jsx`
- Create: `src/pages/Collection.test.jsx`
- Modify: `src/App.jsx`
- Delete: `src/pages/MyCollection.jsx`
- Delete: `src/pages/MyCollection.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/Collection.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Collection from '@/pages/Collection';

const mockUseOwnedFigures = vi.fn();
vi.mock('@/hooks/useOwnedFigures', () => ({ useOwnedFigures: (...a) => mockUseOwnedFigures(...a) }));
vi.mock('@/lib/authStore', () => ({ currentSession: () => ({ user: { id: 'u1' } }) }));

beforeEach(() => { mockUseOwnedFigures.mockReset(); });

function renderPage() {
  return render(<MemoryRouter><Collection /></MemoryRouter>);
}

describe('Collection', () => {
  it('renders empty state when no figures owned', () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [], loading: false, error: null });
    renderPage();
    expect(screen.getByText(/Карт уншуулаад цуглуулгаа эхлүүл/i)).toBeInTheDocument();
    const demoLink = screen.getByRole('link', { name: /Demo тоглоом/i });
    expect(demoLink).toHaveAttribute('href', '/games/quotes/live?demo=1');
  });

  it('renders the owned figures grid with names and tap-to-chat links', () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [1, 3, 14], loading: false, error: null });
    renderPage();
    expect(screen.getByText('Чингис Хаан')).toBeInTheDocument();
    expect(screen.getByText('Хубилай Хаан')).toBeInTheDocument();
    expect(screen.getByText('Бөртэ Үжин')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Чингис Хаан/i });
    expect(link).toHaveAttribute('href', '/c/1');
  });

  it('renders a loading state while loading', () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [], loading: true, error: null });
    renderPage();
    expect(screen.getByText(/Уншиж байна/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Collection.test.jsx`
Expected: FAIL — `Collection` does not exist.

- [ ] **Step 3: Implement Collection.jsx**

Create `src/pages/Collection.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { FIGURES } from '@/lib/figuresData';
import { useOwnedFigures } from '@/hooks/useOwnedFigures';
import { currentSession } from '@/lib/authStore';

export default function Collection() {
  const session = currentSession();
  const userId = session?.user?.id ?? null;
  const { figIds, loading } = useOwnedFigures(userId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-brass">
        Уншиж байна…
      </div>
    );
  }

  if (figIds.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center text-brass">
        <p className="text-lg">Карт уншуулаад цуглуулгаа эхлүүл</p>
        <Link
          to="/games/quotes/live?demo=1"
          className="px-5 py-2 rounded border border-brass/50 hover:bg-brass/10"
        >
          Demo тоглоом руу орох
        </Link>
      </div>
    );
  }

  const owned = figIds
    .map((id) => FIGURES.find((f) => f.fig_id === id))
    .filter(Boolean);

  return (
    <div className="min-h-screen px-4 py-6 bg-ink text-brass">
      <h1 className="text-2xl mb-4">Миний цуглуулга ({owned.length})</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {owned.map((f) => (
          <Link
            key={f.fig_id}
            to={`/c/${f.fig_id}`}
            className="block p-3 rounded border border-brass/30 hover:border-brass/70"
            aria-label={f.name}
          >
            <div className="text-3xl mb-1">{f.ico}</div>
            <div className="text-xs opacity-70">{f.card}</div>
            <div className="font-bold mt-1">{f.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/pages/Collection.test.jsx`
Expected: 3/3 PASS.

- [ ] **Step 5: Update App.jsx import**

Edit `src/App.jsx`:

Old (line 15): `import MyCollection from '@/pages/MyCollection';`
New: `import Collection from '@/pages/Collection';`

Old (line 62): `<Route path="/collection" element={<OtpGate><MyCollection /></OtpGate>} />`
New: `<Route path="/collection" element={<OtpGate><Collection /></OtpGate>} />`

- [ ] **Step 6: Delete old files**

```bash
rm src/pages/MyCollection.jsx src/pages/MyCollection.test.jsx
```

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS (no remaining references to MyCollection).

- [ ] **Step 8: Commit**

```bash
git add src/pages/Collection.jsx src/pages/Collection.test.jsx src/App.jsx
git rm src/pages/MyCollection.jsx src/pages/MyCollection.test.jsx
git commit -m "feat(cards): Collection page replaces MyCollection (driven by useOwnedFigures)"
```

---

## Task 10: Manual smoke test in the dev server

**Files:** none

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite running on `http://localhost:5173` (banner suppressed by `logLevel: 'error'`).

- [ ] **Step 2: Test full scan flow as a new user**

1. Open `http://localhost:5173/c/1` in a private/incognito window.
2. Expected: redirect to `/otp?next=%2Fc%2F1` and the claim-hint line is visible.
3. Register with a fresh username + bootstrap code (`ADMIN001` per `authStore.js:7`).
4. Expected: redirected back to `/c/1`, chat UI loads, figure 1 (Чингис Хаан) is now in collection.
5. Send a message; reload the page.
6. Expected: chat history is preserved.
7. Open `/collection`.
8. Expected: 4 figures visible (3 starter pack + Genghis from the scan).

- [ ] **Step 3: Test ownership idempotency**

1. With the same account, navigate again to `/c/1`.
2. Expected: chat opens immediately (no claim call), prior history hydrated.
3. Check the network tab — there should be no `claim-card` invocation.

- [ ] **Step 4: Test the empty state**

1. Use Supabase MCP `execute_sql` to delete the test user's ownership records:
   ```sql
   delete from card_ownership where user_id = '<test_user_id>';
   update profiles set starter_granted_at = null where id = '<test_user_id>';
   ```
2. Reload `/collection`.
3. Expected: empty state with "Карт уншуулаад цуглуулгаа эхлүүл" + Demo CTA visible.

- [ ] **Step 5: Stop the dev server and document any issues**

If anything fails the manual smoke test, file a follow-up commit.

- [ ] **Step 6: Mark complete**

No commit unless fixes were needed.

---

## Task 11: Verification before completion

**Files:** none

- [ ] **Step 1: Run the full vitest suite**

Run: `npx vitest run`
Expected: all tests pass, including the existing 168 + the new ones (~15 added).

- [ ] **Step 2: Run the figures-shared sync check**

Run: `node scripts/gen-shared-figures.mjs --check`
Expected: "figures.ts is up to date." (No drift introduced.)

- [ ] **Step 3: Verify no eslint errors**

Run: `npm run lint` (if defined; check `package.json`).
Expected: no errors. Skip step if not configured.

- [ ] **Step 4: Confirm git status is clean**

Run: `git status`
Expected: working tree clean.

- [ ] **Step 5: Push to origin**

```bash
git push origin master
```

Expected: push succeeds.

---

## Self-review (run after writing this plan)

**Spec coverage check:**
- Section 1 (Routes & flow) → Task 7, Task 8, Task 9 ✓
- Section 2 (Data model) → Task 1 ✓
- Section 3 (claim-card edge fn) → Task 2 ✓
- Section 4 (grant-starter-pack edge fn) → Task 3 ✓
- Section 5 (Collection page) → Task 9 ✓
- Section 6 (Chat persistence) → Task 5 ✓
- Section 7 (useOwnedFigures hand-off hook) → Task 4 ✓
- Section 8 (Backwards compatibility) → Task 7 (route gate), Task 9 (collection swap) ✓
- Section 9 (Testing) → Tasks 4, 5, 6, 7, 8, 9 (vitest unit) + Task 10 (integration smoke) ✓
- Section 10 (Risks) → noted; not actionable as code ✓
- Section 11 (Out of scope) → no tasks needed ✓

**Type / signature consistency:**
- `useFigureChat(figure, { userId, owned })` — same signature in Task 5 implementation, Task 7 ScanChat consumer, and Task 5 tests ✓
- `useOwnedFigures(userId)` returning `{ figIds, loading, error }` — same in Task 4, Task 7, Task 9 ✓
- `claim-card` body `{ fig_id }` — same in Task 2 server, Task 7 client ✓
- `grant-starter-pack` body `{}` — same in Task 3 server, Task 6 authStore ✓
- Message shape `{ role, text, lang, ts, source? }` — consistent across spec, Task 5 tests, Task 5 implementation ✓

**Placeholder scan:** No TBDs, TODOs, or "implement later" patterns. Each step contains the actual code or command to run.

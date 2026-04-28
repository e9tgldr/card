# Single-device sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A non-admin user account may be signed in on at most one device at a time. A second device sign-in is blocked with an option to take over (which evicts the first device within ~30s). Admins are exempt.

**Architecture:** New `active_sessions` table with one row per non-admin user (`user_id` PK). Two edge functions: `claim-session` calls a single PL/pgSQL function (`claim_session_atomic`, with `FOR UPDATE` row lock) on login; `session-heartbeat` keeps `last_seen` fresh every 30s and evicts mismatched session_ids. Client owns a `session_id` in localStorage, runs the heartbeat from `AuthContext`, and presents a takeover dialog on conflict.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno + supabase-js v2.45), React 18, Vite, Vitest + jsdom. Existing repo at `mongol-history-hub (2)/`.

---

## Spec

`docs/superpowers/specs/2026-04-28-single-device-signin-design.md`

## File structure

**Create:**
- `supabase/migrations/20260428000000_single_device_sessions.sql` — table + atomic claim function + grants.
- `supabase/functions/claim-session/index.ts` — Deno edge fn.
- `supabase/functions/session-heartbeat/index.ts` — Deno edge fn.
- `src/lib/deviceSession.js` — `session_id` storage + heartbeat lifecycle + eviction callback.
- `src/lib/deviceSession.test.js` — vitest unit tests for the client module.

**Modify:**
- `src/lib/authStore.js` — `login()` accepts `force`, calls `claimDeviceSession`. `registerWithCode()` calls `claimDeviceSession`. `logout()` clears local state + stops heartbeat.
- `src/lib/authStore.test.js` — extend with device-conflict cases.
- `src/lib/AuthContext.jsx` — start heartbeat after auth check, register `onEvicted` callback that signs out and routes to `/otp?reason=signed_in_elsewhere`.
- `src/pages/OtpLogin.jsx` — `LoginForm` shows takeover dialog on `device_conflict`; reads `?reason=signed_in_elsewhere` to show one-time eviction banner.
- `src/pages/OtpLogin.test.jsx` — extend with device-conflict UI + banner tests.
- `src/lib/i18n.jsx` — add `auth.deviceConflict*`, `auth.takeOverButton`, `auth.cancelButton`, `auth.evictedBanner` keys (mn + en).

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260428000000_single_device_sessions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260428000000_single_device_sessions.sql
-- Single-device sign-in: tracks the current active session per non-admin user.

create table public.active_sessions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  session_id   uuid not null,
  last_seen    timestamptz not null default now(),
  device_label text,
  created_at   timestamptz not null default now()
);

create index active_sessions_last_seen_idx on public.active_sessions(last_seen);

alter table public.active_sessions enable row level security;
-- No policies: only the service role (used by edge fns) may read or write.

-- Atomic claim. Locks the existing row (if any) under FOR UPDATE so concurrent
-- logins for the same user serialise; the second caller observes the first
-- caller's row state. Returns claimed=false (blocked) when an existing row is
-- still fresh and force is not set.
create or replace function public.claim_session_atomic(
  p_user_id        uuid,
  p_session_id     uuid,
  p_device_label   text,
  p_force          boolean,
  p_stale_seconds  integer
)
returns table (
  claimed              boolean,
  previous_session_id  uuid,
  session_id           uuid,
  last_seen            timestamptz,
  device_label         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
begin
  select a.session_id as sid, a.last_seen as ls, a.device_label as dl
    into v_existing
  from public.active_sessions a
  where a.user_id = p_user_id
  for update;

  if not found then
    insert into public.active_sessions (user_id, session_id, last_seen, device_label)
      values (p_user_id, p_session_id, now(), p_device_label);
    return query select true, null::uuid, p_session_id, now(), p_device_label;
    return;
  end if;

  if v_existing.ls < now() - make_interval(secs => p_stale_seconds) or p_force then
    update public.active_sessions
       set session_id   = p_session_id,
           last_seen    = now(),
           device_label = p_device_label
     where user_id = p_user_id;
    return query
      select true,
             case when v_existing.sid <> p_session_id then v_existing.sid else null end,
             p_session_id, now(), p_device_label;
    return;
  end if;

  return query select false, null::uuid, v_existing.sid, v_existing.ls, v_existing.dl;
end;
$$;

revoke all on function public.claim_session_atomic(uuid, uuid, text, boolean, integer) from public;
grant execute on function public.claim_session_atomic(uuid, uuid, text, boolean, integer) to service_role;
```

- [ ] **Step 2: Apply the migration via supabase MCP**

Use the supabase MCP tool `apply_migration` with `name: "single_device_sessions"` and `query` set to the SQL body above (omitting the comment header line).

- [ ] **Step 3: Smoke-test the function via execute_sql**

Run via the supabase MCP `execute_sql` tool:

```sql
-- 1. First claim — fresh user, no row.
select * from public.claim_session_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'test-device', false, 120
);
-- Expect: claimed=true, previous_session_id=null, session_id=11111…, last_seen≈now()

-- 2. Second claim within window — same user, different session id, no force.
select * from public.claim_session_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  'other-device', false, 120
);
-- Expect: claimed=false, session_id=11111… (existing), device_label='test-device'

-- 3. Force takeover.
select * from public.claim_session_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  'forced-device', true, 120
);
-- Expect: claimed=true, previous_session_id=11111…, session_id=33333…

-- 4. Stale takeover — set last_seen back, then claim without force.
update public.active_sessions
   set last_seen = now() - interval '5 minutes'
 where user_id = '00000000-0000-0000-0000-000000000001';

select * from public.claim_session_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid,
  'stale-takeover', false, 120
);
-- Expect: claimed=true, previous_session_id=33333…, session_id=44444…

-- 5. Cleanup.
delete from public.active_sessions
 where user_id = '00000000-0000-0000-0000-000000000001';
```

If all five behave as expected, the function is correct.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428000000_single_device_sessions.sql
git commit -m "feat(auth): add active_sessions table + claim_session_atomic"
```

---

## Task 2: `claim-session` edge function

**Files:**
- Create: `supabase/functions/claim-session/index.ts`

- [ ] **Step 1: Write the edge function**

```ts
// supabase/functions/claim-session/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

const STALE_SECONDS = 120;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!userJwt) return json({ ok: false, reason: 'unauthorized' }, 401);

  let body: { device_label?: string; force?: boolean };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  // 1. Verify the JWT and extract the user.
  const { data: userResp, error: userErr } = await admin.auth.getUser(userJwt);
  if (userErr || !userResp.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const userId = userResp.user.id;

  // 2. Admin exemption.
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profErr) return json({ ok: false, reason: 'server' }, 500);
  if (profile?.is_admin) return json({ ok: true, exempt: true });

  // 3. Atomic claim.
  const newSessionId = crypto.randomUUID();
  const deviceLabel = (body.device_label ?? '').slice(0, 200);
  const force = !!body.force;

  const { data: rows, error: rpcErr } = await admin.rpc('claim_session_atomic', {
    p_user_id: userId,
    p_session_id: newSessionId,
    p_device_label: deviceLabel,
    p_force: force,
    p_stale_seconds: STALE_SECONDS,
  });
  if (rpcErr) return json({ ok: false, reason: 'server' }, 500);

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return json({ ok: false, reason: 'server' }, 500);

  if (!row.claimed) {
    return json({
      ok: false,
      blocked: true,
      device_label: row.device_label,
      last_seen: row.last_seen,
    });
  }

  // 4. Forced takeover of a *different* prior session → revoke other refresh tokens.
  if (row.previous_session_id) {
    try {
      // admin.signOut takes a JWT; passing the just-verified userJwt with scope
      // 'others' kills every other session for this user except the current one.
      await admin.auth.admin.signOut(userJwt, 'others');
    } catch (e) {
      console.warn('admin.signOut(others) failed:', e);
      // Non-fatal — heartbeat will still evict the old device.
    }
  }

  return json({ ok: true, exempt: false, session_id: newSessionId });
});
```

- [ ] **Step 2: Deploy via supabase MCP**

Use the supabase MCP `deploy_edge_function` tool:
- `name`: `claim-session`
- `entrypoint_path`: `supabase/functions/claim-session/index.ts`
- `import_map_path`: omit (none used)
- `files`: include `supabase/functions/claim-session/index.ts` and `supabase/functions/_shared/cors.ts`.

- [ ] **Step 3: Smoke-test from a real session**

Run from any signed-in dev tab in the browser console (the project's `supabase` import is exposed for debugging via `window.supabase` on dev builds, but if not, paste this into a one-off script):

```js
const { data, error } = await supabase.functions.invoke('claim-session', {
  body: { device_label: 'Chrome on Windows · smoke', force: false },
});
console.log({ data, error });
```

Expected first-call result: `{ ok: true, exempt: false, session_id: "<uuid>" }` (or `{ exempt: true }` if signed in as an admin).

A second call from a *different* browser to the same account should return `{ ok: false, blocked: true, device_label: "...", last_seen: "..." }`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/claim-session/index.ts
git commit -m "feat(auth): add claim-session edge function"
```

---

## Task 3: `session-heartbeat` edge function

**Files:**
- Create: `supabase/functions/session-heartbeat/index.ts`

- [ ] **Step 1: Write the edge function**

```ts
// supabase/functions/session-heartbeat/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!userJwt) return json({ ok: false, reason: 'unauthorized' }, 401);

  let body: { session_id?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const sessionId = body.session_id ?? '';
  if (!sessionId) return json({ ok: false, reason: 'bad_request' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  const { data: userResp, error: userErr } = await admin.auth.getUser(userJwt);
  if (userErr || !userResp.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const userId = userResp.user.id;

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profErr) return json({ ok: false, reason: 'server' }, 500);
  if (profile?.is_admin) return json({ ok: true, exempt: true });

  // Single conditional UPDATE — if the session_id matches we bump last_seen,
  // otherwise zero rows are affected and we report eviction.
  const { data: updated, error: updErr } = await admin
    .from('active_sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .select('user_id');

  if (updErr) return json({ ok: false, reason: 'server' }, 500);

  if (Array.isArray(updated) && updated.length === 1) {
    return json({ ok: true });
  }
  return json({ ok: false, evicted: true });
});
```

- [ ] **Step 2: Deploy via supabase MCP**

Use the supabase MCP `deploy_edge_function` tool:
- `name`: `session-heartbeat`
- `entrypoint_path`: `supabase/functions/session-heartbeat/index.ts`
- `files`: include `supabase/functions/session-heartbeat/index.ts` and `supabase/functions/_shared/cors.ts`.

- [ ] **Step 3: Smoke-test**

From any signed-in dev tab, after running `claim-session` so a row exists:

```js
const sid = '<the session_id returned by claim-session>';
const { data, error } = await supabase.functions.invoke('session-heartbeat', {
  body: { session_id: sid },
});
console.log({ data, error });
// Expect: { ok: true }

const { data: bad } = await supabase.functions.invoke('session-heartbeat', {
  body: { session_id: '00000000-0000-0000-0000-000000000000' },
});
console.log(bad);
// Expect: { ok: false, evicted: true }
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/session-heartbeat/index.ts
git commit -m "feat(auth): add session-heartbeat edge function"
```

---

## Task 4: Client `deviceSession` module

**Files:**
- Create: `src/lib/deviceSession.js`
- Test: `src/lib/deviceSession.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/deviceSession.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockInvoke = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signOut: (...a) => mockSignOut(...a) },
    functions: { invoke: (...a) => mockInvoke(...a) },
  },
}));

beforeEach(() => {
  mockInvoke.mockReset();
  mockSignOut.mockReset();
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('deviceSession.claimDeviceSession', () => {
  it('stores session_id when claim succeeds (non-exempt)', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, exempt: false, session_id: 'sid-1' },
      error: null,
    });
    const mod = await import('@/lib/deviceSession');
    const res = await mod.claimDeviceSession();
    expect(res).toEqual({ ok: true, exempt: false, session_id: 'sid-1' });
    expect(localStorage.getItem('mhh.device_session_id')).toBe('sid-1');
    mod.stopHeartbeat();
  });

  it('does not store session_id when admin is exempt', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, exempt: true },
      error: null,
    });
    const mod = await import('@/lib/deviceSession');
    const res = await mod.claimDeviceSession();
    expect(res).toEqual({ ok: true, exempt: true });
    expect(localStorage.getItem('mhh.device_session_id')).toBeNull();
    mod.stopHeartbeat();
  });

  it('returns blocked payload without storing on conflict', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: false, blocked: true, device_label: 'Chrome', last_seen: '2026-04-28T00:00:00Z' },
      error: null,
    });
    const mod = await import('@/lib/deviceSession');
    const res = await mod.claimDeviceSession();
    expect(res).toEqual({
      ok: false, blocked: true, device_label: 'Chrome', last_seen: '2026-04-28T00:00:00Z',
    });
    expect(localStorage.getItem('mhh.device_session_id')).toBeNull();
  });
});

describe('deviceSession heartbeat', () => {
  it('fires heartbeat on interval and on evicted callback signs out', async () => {
    vi.useFakeTimers();
    localStorage.setItem('mhh.device_session_id', 'sid-1');
    mockInvoke.mockResolvedValue({ data: { ok: false, evicted: true }, error: null });
    mockSignOut.mockResolvedValue({});

    const mod = await import('@/lib/deviceSession');
    const onEvicted = vi.fn();
    mod.onEvicted(onEvicted);
    mod.startHeartbeat();

    await vi.advanceTimersByTimeAsync(30_000);
    // Allow microtasks queued by the heartbeat tick to settle.
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockInvoke).toHaveBeenCalledWith('session-heartbeat', {
      body: { session_id: 'sid-1' },
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(localStorage.getItem('mhh.device_session_id')).toBeNull();
    expect(onEvicted).toHaveBeenCalledTimes(1);

    mod.stopHeartbeat();
  });

  it('exempt response stops the heartbeat without signing out', async () => {
    vi.useFakeTimers();
    localStorage.setItem('mhh.device_session_id', 'sid-1');
    mockInvoke.mockResolvedValue({ data: { ok: true, exempt: true }, error: null });

    const mod = await import('@/lib/deviceSession');
    const onEvicted = vi.fn();
    mod.onEvicted(onEvicted);
    mod.startHeartbeat();

    await vi.advanceTimersByTimeAsync(30_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(onEvicted).not.toHaveBeenCalled();
    expect(localStorage.getItem('mhh.device_session_id')).toBe('sid-1');

    // After exempt response, additional ticks should not call invoke again.
    mockInvoke.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockInvoke).not.toHaveBeenCalled();

    mod.stopHeartbeat();
  });

  it('clearStoredSessionId removes localStorage entry', async () => {
    localStorage.setItem('mhh.device_session_id', 'sid-1');
    const mod = await import('@/lib/deviceSession');
    mod.clearStoredSessionId();
    expect(localStorage.getItem('mhh.device_session_id')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- src/lib/deviceSession.test.js
```

Expected: FAIL with "Cannot find module '@/lib/deviceSession'".

- [ ] **Step 3: Write the module**

```js
// src/lib/deviceSession.js
import { supabase } from '@/lib/supabase';

const SESSION_KEY = 'mhh.device_session_id';
const HEARTBEAT_MS = 30_000;

let timer = null;
let onEvictedCallback = null;
let evicting = false;

export function getStoredSessionId() {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

export function setStoredSessionId(id) {
  try { localStorage.setItem(SESSION_KEY, id); } catch { /* private mode */ }
}

export function clearStoredSessionId() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
}

export function onEvicted(cb) {
  onEvictedCallback = cb;
}

function buildDeviceLabel() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' : 'Unknown';
  return `${browser} on ${os}`;
}

export async function claimDeviceSession({ force = false } = {}) {
  const { data, error } = await supabase.functions.invoke('claim-session', {
    body: { device_label: buildDeviceLabel(), force },
  });
  if (error) return { ok: false, reason: 'server' };
  if (!data) return { ok: false, reason: 'server' };

  if (data.ok && !data.exempt) {
    setStoredSessionId(data.session_id);
    startHeartbeat();
  }
  return data;
}

export function startHeartbeat() {
  stopHeartbeat();
  timer = setInterval(tick, HEARTBEAT_MS);
}

export function stopHeartbeat() {
  if (timer) { clearInterval(timer); timer = null; }
}

async function tick() {
  if (evicting) return;
  const session_id = getStoredSessionId();
  if (!session_id) return;

  let result;
  try {
    result = await supabase.functions.invoke('session-heartbeat', {
      body: { session_id },
    });
  } catch {
    return; // network blip — try again next tick
  }
  const data = result?.data;
  if (!data) return;

  if (data.exempt) { stopHeartbeat(); return; }
  if (data.evicted) {
    evicting = true;
    stopHeartbeat();
    clearStoredSessionId();
    try { await supabase.auth.signOut(); } catch { /* best-effort */ }
    try { onEvictedCallback?.(); } finally { evicting = false; }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test -- src/lib/deviceSession.test.js
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deviceSession.js src/lib/deviceSession.test.js
git commit -m "feat(auth): add deviceSession client module"
```

---

## Task 5: Wire `authStore` into device-session lifecycle

**Files:**
- Modify: `src/lib/authStore.js`
- Modify: `src/lib/authStore.test.js`

- [ ] **Step 1: Add the failing tests to `authStore.test.js`**

Append the following inside the existing `describe('authStore.login', () => { ... })` block (just before its closing `});`):

```js
  it('returns device_conflict and signs out when claim is blocked', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });
    const signOutSpy = vi.fn().mockResolvedValue({});
    // Re-bind signOut for this case.
    const supa = (await import('@/lib/supabase')).supabase;
    supa.auth.signOut = signOutSpy;

    mockInvoke.mockImplementation((name) => {
      if (name === 'claim-session') {
        return Promise.resolve({
          data: { ok: false, blocked: true, device_label: 'Chrome on Windows', last_seen: '2026-04-28T00:00:00Z' },
          error: null,
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });

    const { login } = await import('@/lib/authStore');
    const res = await login({ username: 'testuser', password: 'pass123' });

    expect(res).toEqual({
      ok: false,
      reason: 'device_conflict',
      device_label: 'Chrome on Windows',
      last_seen: '2026-04-28T00:00:00Z',
    });
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('passes force=true through to claim-session on takeover', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });
    mockInvoke.mockImplementation((name, opts) => {
      if (name === 'claim-session') {
        expect(opts.body.force).toBe(true);
        return Promise.resolve({
          data: { ok: true, exempt: false, session_id: 'sid-2' },
          error: null,
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });

    const { login } = await import('@/lib/authStore');
    const res = await login({ username: 'testuser', password: 'pass123', force: true });

    expect(res.ok).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/lib/authStore.test.js
```

Expected: the two new tests FAIL (login currently doesn't call claim-session and doesn't accept `force`).

- [ ] **Step 3: Update `authStore.js`**

Replace the existing `login` and `registerWithCode` and `logout` functions with:

```js
// Replaces existing registerWithCode in src/lib/authStore.js
export const registerWithCode = async ({ code, username, password }) => {
  try {
    const { data, error } = await supabase.functions.invoke('redeem-code', {
      body: { code, username, password },
    });
    if (error) return { ok: false, reason: 'server' };
    if (!data?.ok) return data ?? { ok: false, reason: 'server' };

    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (setErr) return { ok: false, reason: 'session_failed' };

    // Claim the device-session slot. New accounts won't conflict, but the row
    // still needs to exist so the heartbeat has something to update.
    const claim = await claimDeviceSession();
    if (claim?.ok === false && claim.blocked) {
      await supabase.auth.signOut();
      return {
        ok: false,
        reason: 'device_conflict',
        device_label: claim.device_label,
        last_seen: claim.last_seen,
      };
    }

    try {
      await supabase.functions.invoke('grant-starter-pack', { body: {} });
    } catch (err) {
      console.warn('grant-starter-pack invoke failed (will retry next login)', err);
    }

    return { ok: true, account: { username } };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

// Replaces existing login in src/lib/authStore.js
export const login = async ({ username, password, force = false }) => {
  const email = usernameToEmail(username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
      const { data: p } = await supabase
        .from('profiles').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
      return { ok: false, reason: p ? 'bad_password' : 'not_found' };
    }
    return { ok: false, reason: 'server' };
  }

  const claim = await claimDeviceSession({ force });
  if (claim?.ok === false && claim.blocked) {
    await supabase.auth.signOut();
    return {
      ok: false,
      reason: 'device_conflict',
      device_label: claim.device_label,
      last_seen: claim.last_seen,
    };
  }

  try {
    await supabase.functions.invoke('grant-starter-pack', { body: {} });
  } catch (err) {
    console.warn('grant-starter-pack invoke failed (will retry next login)', err);
  }
  return { ok: true, account: { username } };
};

// Replaces existing logout in src/lib/authStore.js
export const logout = async () => {
  clearStoredSessionId();
  stopHeartbeat();
  await supabase.auth.signOut();
};
```

Add these imports at the top of `src/lib/authStore.js` (alongside the existing `supabase` import):

```js
import {
  claimDeviceSession,
  clearStoredSessionId,
  stopHeartbeat,
} from '@/lib/deviceSession';
```

- [ ] **Step 4: Run the full authStore test file**

```bash
npm run test -- src/lib/authStore.test.js
```

Expected: all tests PASS, including the two new ones and the pre-existing happy-path / failure tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authStore.js src/lib/authStore.test.js
git commit -m "feat(auth): wire authStore into deviceSession claim+heartbeat"
```

---

## Task 6: Boot the heartbeat + eviction handler from `AuthContext`

**Files:**
- Modify: `src/lib/AuthContext.jsx`

- [ ] **Step 1: Update `AuthContext.jsx`**

Replace the file with:

```jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  getStoredSessionId,
  startHeartbeat,
  stopHeartbeat,
  onEvicted,
} from '@/lib/deviceSession';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    onEvicted(() => {
      // Heartbeat already cleared local session_id and called supabase.signOut.
      // Surface the eviction to the user via the login screen banner.
      window.location.replace('/otp?reason=signed_in_elsewhere');
    });
    checkAppState();
    return () => stopHeartbeat();
  }, []);

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);
    setAppPublicSettings({ id: 'local', public_settings: {} });
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      // If the user is signed in and we have a stored session_id, resume the
      // heartbeat (e.g., after a page reload).
      if (currentUser && getStoredSessionId()) {
        startHeartbeat();
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout();
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

- [ ] **Step 2: Run the existing test suite to confirm no regressions**

```bash
npm run test
```

Expected: all 193+ tests still PASS (no AuthContext-specific tests exist; this is a smoke check).

- [ ] **Step 3: Commit**

```bash
git add src/lib/AuthContext.jsx
git commit -m "feat(auth): start heartbeat from AuthContext, route on eviction"
```

---

## Task 7: i18n keys

**Files:**
- Modify: `src/lib/i18n.jsx`

- [ ] **Step 1: Add the keys**

In `src/lib/i18n.jsx`, locate the `STRINGS` object (large `export const STRINGS = { ... }` block). Append the following keys at the end of the object (just before its closing `};`). If the file already has an `auth.*` section, place these alongside it; otherwise put them at the bottom with a section comment.

```js
  // Auth — single-device sign-in
  'auth.deviceConflictTitle':
    { mn: 'Энэ данс өөр төхөөрөмж дээр нэвтэрсэн байна',
      en: 'This account is already signed in elsewhere' },
  'auth.deviceConflictBody':
    { mn: 'Сүүлд: {device} · {lastSeen} өмнө',
      en: 'Last seen: {device} · {lastSeen} ago' },
  'auth.takeOverButton':
    { mn: 'Энэ төхөөрөмж дээр нэвтрэх',
      en: 'Sign in here anyway' },
  'auth.cancelButton':
    { mn: 'Болих',
      en: 'Cancel' },
  'auth.evictedBanner':
    { mn: 'Та өөр төхөөрөмж дээр нэвтэрсэн тул энэ төхөөрөмжөөс гарлаа.',
      en: 'You were signed out because this account signed in on another device.' },
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/i18n.jsx
git commit -m "feat(auth): i18n strings for device-conflict + eviction"
```

---

## Task 8: `OtpLogin` — device-conflict UI + eviction banner

**Files:**
- Modify: `src/pages/OtpLogin.jsx`
- Modify: `src/pages/OtpLogin.test.jsx`

- [ ] **Step 1: Add the failing tests**

Append the following inside the top-level `describe('OtpLogin', () => { ... })` (or whatever describe wraps the existing tests; create a new `describe.skip` block above and rename to `describe` after wiring imports if needed):

```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

it('renders the device-conflict dialog when login returns device_conflict', async () => {
  // The mock for authStore.login is set up at the top of this file. Override
  // it to return a device_conflict result.
  const { login } = await import('@/lib/authStore');
  vi.mocked(login).mockResolvedValueOnce({
    ok: false,
    reason: 'device_conflict',
    device_label: 'Chrome on Windows',
    last_seen: new Date(Date.now() - 3 * 60_000).toISOString(),
  });

  const OtpLogin = (await import('@/pages/OtpLogin')).default;
  render(
    <MemoryRouter initialEntries={['/otp?next=/app']}>
      <OtpLogin />
    </MemoryRouter>,
  );

  // Switch to login mode.
  fireEvent.click(screen.getByRole('button', { name: /Нэвтрэх/i }));
  // Fill credentials.
  fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: 'alice' } });
  fireEvent.change(screen.getByPlaceholderText('********'), { target: { value: 'pw1234' } });
  fireEvent.click(screen.getByRole('button', { name: /Нэвтрэх|Sign in/i }));

  await waitFor(() => {
    expect(screen.getByText(/already signed in|өөр төхөөрөмж дээр/i)).toBeInTheDocument();
  });
  expect(screen.getByText(/Chrome on Windows/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sign in here anyway|Энэ төхөөрөмж дээр нэвтрэх/i }))
    .toBeInTheDocument();
});

it('clicking takeover calls login with force=true', async () => {
  const { login } = await import('@/lib/authStore');
  vi.mocked(login)
    .mockResolvedValueOnce({
      ok: false, reason: 'device_conflict',
      device_label: 'Chrome on Windows', last_seen: new Date().toISOString(),
    })
    .mockResolvedValueOnce({ ok: true, account: { username: 'alice' } });

  const OtpLogin = (await import('@/pages/OtpLogin')).default;
  render(
    <MemoryRouter initialEntries={['/otp?next=/app']}>
      <OtpLogin />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Нэвтрэх/i }));
  fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: 'alice' } });
  fireEvent.change(screen.getByPlaceholderText('********'), { target: { value: 'pw1234' } });
  fireEvent.click(screen.getByRole('button', { name: /Нэвтрэх|Sign in/i }));

  const takeover = await screen.findByRole('button', { name: /Sign in here anyway|Энэ төхөөрөмж дээр нэвтрэх/i });
  fireEvent.click(takeover);

  await waitFor(() => {
    expect(vi.mocked(login)).toHaveBeenLastCalledWith({
      username: 'alice', password: 'pw1234', force: true,
    });
  });
});

it('shows eviction banner when ?reason=signed_in_elsewhere is present', async () => {
  const OtpLogin = (await import('@/pages/OtpLogin')).default;
  render(
    <MemoryRouter initialEntries={['/otp?reason=signed_in_elsewhere']}>
      <OtpLogin />
    </MemoryRouter>,
  );
  expect(
    await screen.findByText(/signed out because this account signed in on another device|өөр төхөөрөмж дээр нэвтэрсэн тул/i)
  ).toBeInTheDocument();
});
```

If the existing test file does not already mock `@/lib/authStore`, add the following to the top of the file:

```js
vi.mock('@/lib/authStore', async () => {
  const actual = await vi.importActual('@/lib/authStore');
  return {
    ...actual,
    login: vi.fn(),
    registerWithCode: vi.fn(),
    bootstrapCode: vi.fn().mockResolvedValue(null),
    currentSession: vi.fn().mockReturnValue(null),
    checkInviteCode: vi.fn(),
  };
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- src/pages/OtpLogin.test.jsx
```

Expected: 3 new tests FAIL (no conflict UI, no banner, no force).

- [ ] **Step 3: Update `OtpLogin.jsx`**

Make the following changes to `src/pages/OtpLogin.jsx`:

(a) Add an import alongside the existing `useSearchParams` import:

```js
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
```

(b) Add a top-level eviction banner inside `OtpLogin` (the default-exported component). Replace the opening of its returned JSX block — find:

```jsx
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
```

…and immediately above the existing `<div className="w-full max-w-md ...`, render a banner when the query param is set. Updated body:

```jsx
export default function OtpLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/app';
  const reason = params.get('reason');
  const isClaimFlow = next.startsWith('/c/');
  const { t } = useLang();

  const [mode, setMode] = useState('redeem');
  const [bootstrap, setBootstrap] = useState(null);

  useEffect(() => {
    if (currentSession()) { navigate(next, { replace: true }); return; }
    bootstrapCode().then(setBootstrap);
  }, [navigate, next]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: 'linear-gradient(180deg, #0a0c14 0%, #100d04 50%, #0a0c14 100%)' }}
    >
      <div className="w-full max-w-md space-y-4">
        {reason === 'signed_in_elsewhere' && (
          <div
            role="status"
            className="rounded-md p-3 text-sm font-cormorant text-center"
            style={{ border: '1px solid rgba(220,90,90,0.5)', background: 'rgba(220,90,90,0.08)', color: '#f4caca' }}
          >
            {t('auth.evictedBanner')}
          </div>
        )}

        <div className="rounded-2xl p-8 space-y-6" style={panelStyle}>
          {/* … keep the existing inner block (header, mode toggle, RedeemForm/LoginForm, footer link) … */}
        </div>
      </div>
    </div>
  );
}
```

When making this change, keep the original inner block (the `<div className="w-full max-w-md rounded-2xl p-8 space-y-6" ...>` and everything inside it) intact — just move it to be the inner panel under the new wrapper, dropping the `w-full max-w-md` classes since the wrapper now owns the width.

(c) Replace the `LoginForm` component with this version that handles the device-conflict dialog:

```jsx
function LoginForm({ next, navigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(null); // { device_label, last_seen } | null
  const { t } = useLang();

  const doLogin = async ({ force }) => {
    setError('');
    setBusy(true);
    const result = await login({ username, password, force });
    setBusy(false);

    if (result.ok) {
      setConflict(null);
      notify.success('toast.auth.loginSuccess');
      navigate(next, { replace: true });
      return;
    }
    if (result.reason === 'device_conflict') {
      setConflict({ device_label: result.device_label, last_seen: result.last_seen });
      return;
    }
    setError(errMsg(result.reason));
  };

  const submit = (e) => { e.preventDefault(); doLogin({ force: false }); };

  if (conflict) {
    return (
      <div className="space-y-4" role="alertdialog" aria-labelledby="device-conflict-title">
        <h3 id="device-conflict-title" className="font-playfair text-lg" style={{ color: '#e8d5a3' }}>
          {t('auth.deviceConflictTitle')}
        </h3>
        <p className="text-sm font-cormorant" style={{ color: '#e8d5a3cc' }}>
          {t('auth.deviceConflictBody', {
            device: conflict.device_label || '—',
            lastSeen: relativeTime(conflict.last_seen),
          })}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConflict(null)}
            className="flex-1"
          >
            {t('auth.cancelButton')}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => doLogin({ force: true })}
            className="flex-1 font-cormorant tracking-wider uppercase"
            style={{ background: '#c9a84c', color: '#0a0c14' }}
          >
            {busy ? '…' : t('auth.takeOverButton')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {/* … keep the existing form fields exactly as-is (username + password inputs + error + submit button) … */}
    </form>
  );
}

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const m = Math.round(ms / 60_000);
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} d`;
}
```

When you replace `LoginForm`, keep the existing fields (username input, PasswordInput, error rendering, submit Button) inside the bottom `<form>`. The only change to the form-rendering branch is calling `doLogin` instead of inlining the login call.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test -- src/pages/OtpLogin.test.jsx
```

Expected: all OtpLogin tests PASS, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/pages/OtpLogin.jsx src/pages/OtpLogin.test.jsx
git commit -m "feat(auth): device-conflict dialog + eviction banner in OtpLogin"
```

---

## Task 9: Full-suite verification + manual test

**Files:** none (verification only).

- [ ] **Step 1: Run the full vitest suite**

```bash
npm run test
```

Expected: all tests PASS. Pre-feature baseline was 193 (per the `live_mp_roster_gate_shipped` memory). New tests added: ~10 (5 in deviceSession, 2 in authStore, 3 in OtpLogin). Expected new total: ~203 tests, all green.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 3: Build production bundle**

```bash
npm run build
```

Expected: clean build, no warnings about missing imports.

- [ ] **Step 4: Manual smoke test (two real browsers)**

1. Open browser A (e.g., Chrome) and browser B (e.g., Firefox or Chrome incognito) to the deployed site.
2. In A, log in to a non-admin test account `alice`.
3. In A, observe network tab — `session-heartbeat` should fire every 30s with `200 ok: true`.
4. In B, attempt to log in as `alice` → expect the device-conflict dialog naming "Chrome on Windows" (or whatever A is) and a relative time like "<1 min".
5. In B, click *Sign in here anyway* → B redirects to `/app`.
6. Within ~30s, A's heartbeat returns `evicted: true`, A clears its session, and A is on `/otp?reason=signed_in_elsewhere` with the red eviction banner.
7. Close A's tab. In B, log out. In A (reopen), wait 2 minutes, then log in as `alice` → expect clean success with no takeover prompt.
8. Log in as an admin account in both A and B simultaneously → both succeed; no `claim-session` row exists for the admin (verify via `select * from active_sessions where user_id = '<admin_id>'` → 0 rows); no heartbeat traffic in either tab's network panel.

If all 8 steps behave as described, the feature is shipped.

- [ ] **Step 5: Update CLAUDE.md memory after merge**

Add a memory entry summarising the feature, similar to existing `live_mp_roster_gate_shipped.md` — date, what shipped, total tests green, and any gotchas discovered during the manual smoke test.

---

## Self-review notes

- **Spec coverage:**
  - Schema → Task 1.
  - `claim-session` edge fn → Task 2.
  - `session-heartbeat` edge fn → Task 3.
  - Client `deviceSession.js` → Task 4.
  - `authStore.login/register/logout` → Task 5.
  - `App.jsx`/`AuthContext.jsx` heartbeat lifecycle → Task 6.
  - i18n → Task 7.
  - `OtpLogin.jsx` UI → Task 8.
  - Manual test plan → Task 9.

- **Atomicity (Codex P2):** Task 1's `claim_session_atomic` uses `SELECT … FOR UPDATE`; Task 3's heartbeat uses a single conditional UPDATE. Both addressed.

- **`admin.signOut` signature (Codex P1):** Task 2 passes `userJwt` (not `user_id`) with scope `'others'`.

- **Edge-fn unit tests:** This project has no Deno test harness in tree (verified — no `__tests__` under `supabase/functions`). Edge fns are validated via Step 3 smoke tests in Tasks 2 and 3 plus the end-to-end manual test in Task 9. If you later add a Deno test setup, port the smoke-test SQL/curl flows.

# Single-device sign-in

**Date:** 2026-04-28
**Status:** Design (pending user review)

## Goal

A non-admin user account may be signed in on at most one device at a time. If a second device attempts to sign in while the first is still active, the second sign-in is blocked with the option to take over (which evicts the first device). Admins are exempt and may sign in on multiple devices.

## Non-goals

- Tracking historical sessions for audit. Only the *current* active session is stored.
- Per-tab enforcement. Tabs of the same browser share localStorage and the same Supabase session, and therefore the same `session_id`.
- IP / geo restrictions. Device label is informational, not enforced.

## Behavior

### Login on a fresh device, no prior session

1. User submits credentials → `supabase.auth.signInWithPassword` succeeds.
2. Client calls `claim-session` edge fn.
3. Server records the new session and returns `{ok: true, session_id}`.
4. Client stores `session_id` in localStorage and starts the 30-second heartbeat.

### Login while another device is active

1. User submits credentials → Supabase login succeeds.
2. `claim-session` finds a row with `last_seen` within 120 seconds and returns `{blocked: true, device_label, last_seen}`.
3. Client signs the user back out (`supabase.auth.signOut`) and shows the device-conflict UI: *"This account is already signed in on Chrome on Windows · 3 minutes ago. [Sign in here anyway] [Cancel]"*.
4. **Cancel** → returns to the login form.
5. **Sign in here anyway** → re-runs the login + calls `claim-session` with `force: true`. Server overwrites the row, calls `supabase.auth.admin.signOut(user_id, 'others')` to revoke the old refresh tokens, and returns `{ok: true, session_id}`.
6. The original device's next heartbeat (within 30s) detects the `session_id` mismatch, signs out, and routes to `/login?reason=signed_in_elsewhere` showing a one-time banner.

### Login after the original device went silent

If the prior device closed its tab or lost network for ≥ 120 seconds, `last_seen` is stale and `claim-session` treats the slot as free. The new login proceeds without a takeover prompt.

### Admin login

`claim-session` reads `profiles.is_admin`. If true, the function returns `{ok: true, exempt: true}` without writing or reading the `active_sessions` table. The client recognises `exempt: true` and does not start the heartbeat. Any number of devices may be signed in to the same admin account simultaneously.

### Logout

Client clears the local `session_id`, stops the heartbeat, then calls `supabase.auth.signOut()`. The DB row is left in place; staleness (or the next login) reclaims the slot. No `release-session` fn is needed.

## Schema

Migration: `supabase/migrations/20260428000000_single_device_sessions.sql`

```sql
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

  -- Fresh row, not forced → blocked. Surface the existing row so the edge fn
  -- can pass device_label / last_seen back to the client.
  return query select false, null::uuid, v_existing.sid, v_existing.ls, v_existing.dl;
end;
$$;

revoke all on function public.claim_session_atomic(uuid, uuid, text, boolean, integer) from public;
grant execute on function public.claim_session_atomic(uuid, uuid, text, boolean, integer) to service_role;
```

**Constants:**

- `STALE_SECONDS = 120` — a session is considered free after 120 seconds with no heartbeat.
- `HEARTBEAT_MS = 30000` — client heartbeat interval.

## Edge functions

Two new functions, deployed via the supabase MCP tool. Both follow the existing `_shared/cors.ts` + service-role-client pattern used by `redeem-code` and `grant-starter-pack`.

### `claim-session`

**Request** (`POST`, `Authorization: Bearer <user_jwt>`):

```json
{ "device_label": "Chrome on Windows", "force": false }
```

**Logic:**

1. Extract the JWT from the `Authorization` header (`userJwt`). Verify it → `user_id`. Reject 401 if missing or invalid.
2. Read `profiles.is_admin`. If true → return `{ok: true, exempt: true}`, no DB write.
3. Generate `new_session_id = crypto.randomUUID()`.
4. Call the atomic claim:
   ```ts
   const { data, error } = await sb.rpc('claim_session_atomic', {
     p_user_id: user_id,
     p_session_id: new_session_id,
     p_device_label: device_label,
     p_force: !!force,
     p_stale_seconds: 120,
   });
   const row = data?.[0];
   ```
5. If `row.claimed === false` → return `{ok: false, blocked: true, device_label: row.device_label, last_seen: row.last_seen}`.
6. If `row.claimed === true` and `row.previous_session_id` is non-null (forced takeover of a different session) → `await sb.auth.admin.signOut(userJwt, 'others')`. Note: `admin.signOut` takes a **JWT** (the user's access token), not a user_id; passing the just-verified `userJwt` with scope `'others'` revokes all of this user's *other* sessions while leaving the current one (the one the JWT belongs to) intact. Errors from this call are logged but do not fail the response — the heartbeat will still evict the old device within 30s as a backstop.
7. Return `{ok: true, session_id: new_session_id, exempt: false}`.

### `session-heartbeat`

**Request** (`POST`, `Authorization: Bearer <user_jwt>`):

```json
{ "session_id": "<uuid stored in client>" }
```

**Logic:**

1. Verify JWT → `user_id`. Reject 401 if missing.
2. Read `profiles.is_admin`. If true → return `{ok: true, exempt: true}` (client stops heartbeat).
3. Run a single conditional UPDATE:
   ```sql
   update public.active_sessions
      set last_seen = now()
    where user_id = $1 and session_id = $2
   returning user_id;
   ```
   (One statement, no read-then-update — avoids the same race class as the claim path.)
4. If `rows.length === 1` → return `{ok: true}`.
5. Otherwise (no matching row) → return `{ok: false, evicted: true}`.

## Client integration

### New module: `src/lib/deviceSession.js`

Owns `session_id` storage, heartbeat lifecycle, and the eviction callback. Exports:

- `claimDeviceSession({force})` — calls `claim-session`, stores `session_id`, starts heartbeat.
- `startHeartbeat()` / `stopHeartbeat()` — lifecycle.
- `clearStoredSessionId()` — cleanup on logout.
- `onEvicted(cb)` — registers a one-shot callback fired when the heartbeat returns `evicted: true`.

`buildDeviceLabel()` produces a coarse string from `navigator.userAgent` like "Chrome on Windows" — informational only, no fingerprinting.

### Wire-ups

- `src/lib/authStore.js`:
  - `login({ username, password, force = false })` — after `signInWithPassword`, call `claimDeviceSession({ force })`. If `{blocked: true}` → sign back out, return `{ok: false, reason: 'device_conflict', device_label, last_seen}`. If `{ok: true}` → proceed with `grant-starter-pack`. The new `force` parameter exists so the takeover button can re-run `login` end-to-end without re-prompting for credentials.
  - `registerWithCode()` — call `claimDeviceSession()` after `setSession`. (Conflicts unlikely on a new account but the row still needs to exist.)
  - `logout()` — `clearStoredSessionId()` + `stopHeartbeat()` before `supabase.auth.signOut()`.
- `src/App.jsx` — on mount and on Supabase `onAuthStateChange` `SIGNED_IN`, register `onEvicted(navigateToLoginWithBanner)` and start the heartbeat if there's a stored `session_id`.

### UX

- `src/pages/OtpLogin.jsx`:
  - New state branch when `login()` returns `device_conflict`: show the dialog described under *Behavior → Login while another device is active*.
  - "Sign in here anyway" calls `login({ username, password, force: true })` (credentials are still in form state from the original submit). On success → normal redirect.
  - Reads `?reason=signed_in_elsewhere` query param to show the one-time eviction banner.

### i18n

New keys in `src/lib/i18n.jsx` for both Mongolian and English:

- `auth.deviceConflictTitle`
- `auth.deviceConflictBody` (template with `{device}` and `{lastSeen}`)
- `auth.takeOverButton`
- `auth.cancelButton`
- `auth.evictedBanner`

## Testing

Following existing vitest + jsdom patterns:

- `src/lib/deviceSession.test.js` — heartbeat starts/stops; eviction triggers callback once; `exempt: true` stops the heartbeat; `claimDeviceSession` only stores `session_id` when not exempt.
- `src/lib/authStore.test.js` (extend) — `login()` returns `device_conflict` on block; succeeds on ok; admin path skips session storage; `registerWithCode` calls `claimDeviceSession`.
- `src/pages/OtpLogin.test.jsx` (extend) — device-conflict UI renders; takeover button calls force-claim; `?reason=signed_in_elsewhere` banner renders.
- Edge-fn tests in `supabase/functions/_shared/__tests__/`:
  - `claim-session`: blocks within window, allows when stale, exempts admins, force overrides, force triggers `admin.signOut`.
  - `session-heartbeat`: bumps `last_seen` on match, evicts on mismatch, exempts admins.

**Manual test plan** (run after merge):

1. Two browsers. Log in to account X on browser A. Try browser B → expect device-conflict UI naming "Chrome on …".
2. Click *Sign in here anyway* on B → within 30s, browser A flips to login with the eviction banner.
3. Close browser A without logging out. Wait 2 minutes. Log in on B → expect clean success, no takeover prompt.
4. Log in as an admin account on both A and B simultaneously → both work; network tab shows no heartbeat calls.

## Risks and trade-offs

- **30-second eviction lag.** A taken-over device can briefly continue making API calls until its next heartbeat. Mitigation: `claim-session` with `force: true` revokes the old refresh tokens via `auth.admin.signOut(userJwt, 'others')`, so any token refresh will fail; the access-token window is bounded by Supabase's default ~1h TTL but in practice the heartbeat catches it in seconds.
- **Concurrent-login race.** Two devices submitting credentials within milliseconds of each other could each separately read "no row" or a stale row before the other commits. Mitigation: the claim is performed inside a single PL/pgSQL function (`claim_session_atomic`) that holds a row-level `FOR UPDATE` lock, so the second caller serialises behind the first and observes the freshly written row.
- **Stale-session window.** If a user closes their tab abruptly, they must wait up to 120s before they can sign in elsewhere without the takeover dialog. Acceptable cost for not requiring a `release-session` API call (which would be unreliable on tab close anyway).
- **Admin exemption asymmetry.** Admin accounts are higher-value targets and the very accounts where shared sign-ins are most damaging. The exemption is a deliberate convenience trade-off; if abuse becomes a concern, the per-user `is_admin` check in the edge fns is the single point to revisit.
- **Service-role-only writes.** Using a service-role client in edge fns means we don't have to author RLS policies that would otherwise need to permit the heartbeat update without permitting `session_id` overwrites. Costs nothing extra — every other edge fn in this project already uses the same pattern.

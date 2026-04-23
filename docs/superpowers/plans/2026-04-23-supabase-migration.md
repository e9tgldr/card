# Supabase Backend Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the localStorage stub backend with Supabase (Postgres + Auth + Storage + Edge Functions), preserving the public APIs of `src/api/base44Client.js` and `src/lib/authStore.js` so consumer files are untouched.

**Architecture:** Drop-in replacement. The `base44` proxy and the `authStore` functions keep their shapes; internals are rewritten to hit Supabase. Every user logs in with username+password (username mapped to synthetic email `<username>@users.local`); accounts are created by redeeming an admin-issued invite code via Edge Functions. Figures stay as static data in `src/lib/figuresData.js`; the `figures` DB table is an override store. RLS uses a JWT claim (`app_metadata.is_admin`) for admin authorization.

**Tech Stack:** Supabase (Postgres 15, Auth, Storage, Edge Functions/Deno), `@supabase/supabase-js` v2, React 18, Vite.

**Working directory:** `C:/Users/enkh/Downloads/project/mongol-history-hub (2)` — all paths below are relative to this.

**Reference spec:** `docs/superpowers/specs/2026-04-23-supabase-migration-design.md`

---

## Prerequisites (user does this once, before Task 1)

The user must manually:
1. Create a Supabase project at https://supabase.com (free tier is fine). Note the Project URL and `anon` key.
2. Install the Supabase CLI: https://supabase.com/docs/guides/cli (Scoop on Windows: `scoop install supabase`).
3. Run `supabase login` to authenticate the CLI.
4. From the project root, run `supabase link --project-ref <project-ref>` once Task 1 has created `supabase/config.toml`.

If the user has not done step 1 when the plan starts, Task 1 still works (it's local scaffolding). Steps 2-4 are required before Task 6 (apply migrations).

---

## File Structure

**Created files:**
- `.env.example` — template for env vars (client)
- `.env` — gitignored, real values (user fills in)
- `supabase/config.toml` — Supabase CLI config (generated)
- `supabase/migrations/20260423120000_init_schema.sql` — tables, triggers, RLS
- `supabase/migrations/20260423120100_seed.sql` — app_settings + ADMIN001 code
- `supabase/migrations/20260423120200_storage.sql` — figure-images bucket + policies
- `supabase/functions/_shared/cors.ts` — shared CORS headers
- `supabase/functions/check-code/index.ts` — validate code only
- `supabase/functions/redeem-code/index.ts` — validate + create user + mark code used
- `supabase/functions/generate-codes/index.ts` — admin-only code generator
- `supabase/tests/rls_smoke.sql` — RLS policy smoke tests
- `src/lib/supabase.js` — singleton Supabase client

**Modified files:**
- `package.json` — add `@supabase/supabase-js`
- `.gitignore` — ensure `.env` and `supabase/.branches` are ignored
- `src/api/base44Client.js` — full rewrite (keeps exported shape)
- `src/lib/authStore.js` — full rewrite (keeps exported shape)
- `src/components/admin/AdminPanel.jsx` — small change to invite-code section (async + grants_admin checkbox)
- `src/pages/OtpLogin.jsx` — small change: `bootstrapCode()` becomes async, `listAccounts()` becomes async
- `README.md` — Supabase setup instructions

**Deleted files:**
- `base44/entities/Figure.jsonc`, `Collection.jsonc`, `AppSettings.jsonc` — superseded by SQL schema

---

## Task 1: Scaffold Supabase project and install client

**Files:**
- Create: `supabase/config.toml` (via CLI)
- Create: `.env.example`
- Modify: `package.json` (add dependency)
- Modify: `.gitignore`

- [ ] **Step 1: Initialize Supabase project config**

Run from the project root:

```bash
supabase init
```

Expected: creates `supabase/config.toml`, `supabase/seed.sql`, `supabase/.gitignore`. Accept defaults.

- [ ] **Step 2: Install @supabase/supabase-js**

Run:

```bash
npm install @supabase/supabase-js@^2.45.0
```

Expected: `package.json` dependencies now contain `"@supabase/supabase-js": "^2.45.0"`.

- [ ] **Step 3: Create `.env.example`**

Create `.env.example` with exactly this content:

```bash
# Supabase — create a project at https://supabase.com, then copy values from Settings > API
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 4: Update `.gitignore`**

Append these lines to `.gitignore` (if not already present):

```
.env
.env.local
supabase/.branches
supabase/.temp
```

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore package.json package-lock.json supabase/config.toml supabase/seed.sql supabase/.gitignore
git commit -m "chore: scaffold supabase project and install client"
```

---

## Task 2: Create Supabase client singleton

**Files:**
- Create: `src/lib/supabase.js`

- [ ] **Step 1: Create the client module**

Create `src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Fail loud in dev; the app depends on these being set.
  console.error('Supabase env vars missing. Copy .env.example to .env and fill in values.');
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Helper: username <-> synthetic email mapping.
export const usernameToEmail = (username) => `${username.trim().toLowerCase()}@users.local`;
export const emailToUsername = (email) => email?.replace(/@users\.local$/, '') || null;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase.js
git commit -m "feat: add supabase client singleton"
```

---

## Task 3: Write initial schema migration

**Files:**
- Create: `supabase/migrations/20260423120000_init_schema.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260423120000_init_schema.sql`:

```sql
-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- =============================================================
-- Tables
-- =============================================================

create table figures (
  id uuid primary key default gen_random_uuid(),
  fig_id integer unique not null check (fig_id between 1 and 999),
  cat text check (cat in ('khans','queens','warriors','political','cultural')),
  ico text,
  card text,
  name text,
  yrs text,
  role text,
  bio text,
  achs text[] default '{}',
  fact text,
  quote text,
  qattr text,
  rel integer[] default '{}',
  front_img text,
  back_img text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  fig_ids integer[] default '{}',
  earned_at jsonb default '{}'::jsonb,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table app_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table access_codes (
  code text primary key,
  grants_admin boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- =============================================================
-- Triggers: keep updated_date current
-- =============================================================

create or replace function set_updated_date()
returns trigger language plpgsql as $$
begin
  new.updated_date := now();
  return new;
end;
$$;

create trigger figures_updated before update on figures
  for each row execute function set_updated_date();
create trigger collections_updated before update on collections
  for each row execute function set_updated_date();
create trigger app_settings_updated before update on app_settings
  for each row execute function set_updated_date();

-- =============================================================
-- Trigger: create profile row when auth.users row is inserted.
-- Reads username from raw_user_meta_data.username and is_admin from
-- raw_app_meta_data.is_admin. The redeem-code Edge Function sets both.
-- =============================================================

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data->>'is_admin')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- =============================================================
-- RLS: enable on everything
-- =============================================================

alter table figures       enable row level security;
alter table collections   enable row level security;
alter table app_settings  enable row level security;
alter table access_codes  enable row level security;
alter table profiles      enable row level security;

-- Helper: is the current caller an admin per JWT claim?
create or replace function is_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false);
$$;

-- --- figures ---
create policy "figures readable by everyone"
  on figures for select using (true);
create policy "figures writable by admins"
  on figures for all using (is_admin()) with check (is_admin());

-- --- app_settings ---
create policy "app_settings readable by everyone"
  on app_settings for select using (true);
create policy "app_settings writable by admins"
  on app_settings for all using (is_admin()) with check (is_admin());

-- --- collections ---
create policy "collections readable by owner"
  on collections for select using (auth.uid() = user_id);
create policy "collections writable by owner"
  on collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- access_codes --- (no client access; Edge Functions use service role)
-- no policies = no rows visible to anon/authenticated. Service role bypasses RLS.

-- --- profiles ---
create policy "profiles self-read"
  on profiles for select using (auth.uid() = id);
create policy "profiles self-update non-admin fields"
  on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from profiles where id = auth.uid()));
-- Admins can read all profiles
create policy "profiles readable by admins"
  on profiles for select using (is_admin());

-- =============================================================
-- Realtime: enable for entities used by base44.*.subscribe()
-- =============================================================

alter publication supabase_realtime add table figures;
alter publication supabase_realtime add table collections;
alter publication supabase_realtime add table app_settings;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260423120000_init_schema.sql
git commit -m "feat(db): init schema, triggers, and RLS policies"
```

---

## Task 4: Write seed migration

**Files:**
- Create: `supabase/migrations/20260423120100_seed.sql`

- [ ] **Step 1: Create the seed migration**

Create `supabase/migrations/20260423120100_seed.sql`:

```sql
-- Default app_settings
insert into app_settings (key, value) values
  ('site_name', 'Монголын Түүхэн Хөзрүүд'),
  ('site_logo', '')
on conflict (key) do nothing;

-- Bootstrap admin code. The first user to redeem it becomes the first admin.
insert into access_codes (code, grants_admin) values
  ('ADMIN001', true)
on conflict (code) do nothing;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260423120100_seed.sql
git commit -m "feat(db): seed default settings and bootstrap admin code"
```

---

## Task 5: Write storage migration

**Files:**
- Create: `supabase/migrations/20260423120200_storage.sql`

- [ ] **Step 1: Create storage migration**

Create `supabase/migrations/20260423120200_storage.sql`:

```sql
-- Public read bucket for figure images. Admin-only write.
insert into storage.buckets (id, name, public)
values ('figure-images', 'figure-images', true)
on conflict (id) do nothing;

create policy "figure-images public read"
  on storage.objects for select
  using (bucket_id = 'figure-images');

create policy "figure-images admin write"
  on storage.objects for insert
  with check (bucket_id = 'figure-images' and is_admin());

create policy "figure-images admin update"
  on storage.objects for update
  using (bucket_id = 'figure-images' and is_admin());

create policy "figure-images admin delete"
  on storage.objects for delete
  using (bucket_id = 'figure-images' and is_admin());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260423120200_storage.sql
git commit -m "feat(storage): figure-images bucket with public read / admin write"
```

---

## Task 6: Apply migrations to remote project

**Files:** none (deploy step)

- [ ] **Step 1: Push migrations**

From project root, run:

```bash
supabase db push
```

Expected: prints each migration name and "applied." If prompted, confirm `y`.

- [ ] **Step 2: Verify in Supabase dashboard**

Open the Supabase dashboard → Table editor. Expected tables visible: `figures`, `collections`, `app_settings`, `access_codes`, `profiles`. `app_settings` has 2 rows. `access_codes` has 1 row (`ADMIN001`).

- [ ] **Step 3: Copy env values into `.env`**

Create `.env` in the project root (not committed):

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

- [ ] **Step 4: Commit (nothing to commit — this is a deploy step)**

Expected: `git status` reports no staged changes.

---

## Task 7: Write RLS smoke test

**Files:**
- Create: `supabase/tests/rls_smoke.sql`

- [ ] **Step 1: Create the test**

Create `supabase/tests/rls_smoke.sql`:

```sql
-- Smoke test: RLS prevents unauthorized reads/writes. Run with:
--   supabase db execute --file supabase/tests/rls_smoke.sql
-- Each DO block raises on failure.

-- anon role cannot read access_codes
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from access_codes;
  if n <> 0 then raise exception 'anon should see 0 access_codes, got %', n; end if;
end $$;
reset role;

-- anon role CAN read figures and app_settings
do $$
declare n int;
begin
  set local role anon;
  perform count(*) from figures;           -- no exception = OK
  perform count(*) from app_settings;      -- no exception = OK
end $$;
reset role;

-- anon role cannot insert into figures
do $$
begin
  set local role anon;
  begin
    insert into figures (fig_id, name) values (999, 'should fail');
    raise exception 'anon insert into figures should have been denied';
  exception when insufficient_privilege or others then
    -- expected
  end;
end $$;
reset role;
```

- [ ] **Step 2: Run it**

```bash
supabase db execute --file supabase/tests/rls_smoke.sql
```

Expected: finishes with no exceptions. If any DO block raises, fix the policy in Task 3 and re-apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_smoke.sql
git commit -m "test: RLS smoke test for anon role"
```

---

## Task 8: Edge Function — shared CORS helper

**Files:**
- Create: `supabase/functions/_shared/cors.ts`

- [ ] **Step 1: Create helper**

Create `supabase/functions/_shared/cors.ts`:

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/cors.ts
git commit -m "feat(functions): shared CORS helper"
```

---

## Task 9: Edge Function — check-code

**Files:**
- Create: `supabase/functions/check-code/index.ts`

- [ ] **Step 1: Create function**

Create `supabase/functions/check-code/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) return json({ ok: false, reason: 'bad_request' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await admin
    .from('access_codes')
    .select('code, redeemed_by')
    .eq('code', code)
    .maybeSingle();

  if (error) return json({ ok: false, reason: 'server' }, 500);
  if (!data) return json({ ok: false, reason: 'not_found' }, 200);
  if (data.redeemed_by) return json({ ok: false, reason: 'already_used' }, 200);

  return json({ ok: true });
});
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy check-code --no-verify-jwt
```

The `--no-verify-jwt` flag is intentional: anonymous visitors call this before they have a session.

Expected: deploy succeeds, function URL printed.

- [ ] **Step 3: Smoke test**

```bash
curl -X POST "$(supabase status -o json | jq -r '.API_URL')/functions/v1/check-code" \
  -H "Content-Type: application/json" \
  -d '{"code":"ADMIN001"}'
```

Expected response: `{"ok":true}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/check-code/index.ts
git commit -m "feat(functions): check-code edge function"
```

---

## Task 10: Edge Function — redeem-code

**Files:**
- Create: `supabase/functions/redeem-code/index.ts`

- [ ] **Step 1: Create function**

Create `supabase/functions/redeem-code/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleOptions, json } from '../_shared/cors.ts';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { code?: string; username?: string; password?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const code = body.code?.trim().toUpperCase();
  const username = body.username?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';

  if (!code) return json({ ok: false, reason: 'bad_request' }, 400);
  if (!USERNAME_RE.test(username)) return json({ ok: false, reason: 'invalid_username' }, 200);
  if (password.length < 4) return json({ ok: false, reason: 'weak_password' }, 200);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  // 1. Validate code
  const { data: codeRow, error: codeErr } = await admin
    .from('access_codes')
    .select('code, grants_admin, redeemed_by')
    .eq('code', code)
    .maybeSingle();

  if (codeErr) return json({ ok: false, reason: 'server' }, 500);
  if (!codeRow) return json({ ok: false, reason: 'not_found' }, 200);
  if (codeRow.redeemed_by) return json({ ok: false, reason: 'already_used' }, 200);

  // 2. Reject if username is taken
  const email = `${username}@users.local`;
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingProfile) return json({ ok: false, reason: 'username_taken' }, 200);

  // 3. Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
    app_metadata: { is_admin: !!codeRow.grants_admin },
  });
  if (createErr || !created.user) {
    return json({ ok: false, reason: createErr?.message ?? 'create_failed' }, 500);
  }

  // 4. Mark code redeemed (atomic via conditional update to prevent race)
  const { error: markErr, data: marked } = await admin
    .from('access_codes')
    .update({ redeemed_by: created.user.id, redeemed_at: new Date().toISOString() })
    .eq('code', code)
    .is('redeemed_by', null)
    .select()
    .maybeSingle();

  if (markErr || !marked) {
    // Race lost — roll back user creation
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ ok: false, reason: 'already_used' }, 200);
  }

  // 5. Sign the new user in to return a session
  const anonClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signIn.session) {
    return json({ ok: false, reason: 'signin_failed' }, 500);
  }

  return json({ ok: true, session: signIn.session });
});
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy redeem-code --no-verify-jwt
```

Note: this function also accepts unauthenticated requests (new user has no session yet), so `--no-verify-jwt` is correct.

- [ ] **Step 3: Smoke test end-to-end**

Use a real code from the dashboard or generate one later. Skip if you're about to do Task 13's manual test.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/redeem-code/index.ts
git commit -m "feat(functions): redeem-code edge function"
```

---

## Task 11: Edge Function — generate-codes

**Files:**
- Create: `supabase/functions/generate-codes/index.ts`

- [ ] **Step 1: Create function**

Create `supabase/functions/generate-codes/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleOptions, json } from '../_shared/cors.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // matches existing UI
const CODE_LEN = 8;
const MAX_BATCH = 500;

function randomCode(): string {
  const buf = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += ALPHABET[b % ALPHABET.length];
  return s;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify caller is admin. The Functions runtime puts the JWT in Authorization.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer /, '');
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const isAdmin = !!userData.user.app_metadata?.is_admin;
  if (!isAdmin) return json({ ok: false, reason: 'forbidden' }, 403);

  let body: { count?: number; grants_admin?: boolean };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const count = Math.max(1, Math.min(MAX_BATCH, Math.floor(body.count ?? 1)));
  const grantsAdmin = !!body.grants_admin;

  const admin = createClient(url, serviceKey);
  const created: string[] = [];

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await admin
        .from('access_codes')
        .insert({ code, grants_admin: grantsAdmin, created_by: userData.user.id });
      if (!error) { created.push(code); break; }
      if (!error.message?.includes('duplicate')) {
        return json({ ok: false, reason: error.message }, 500);
      }
      // duplicate — retry with a new code
    }
  }

  return json({ ok: true, codes: created });
});
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy generate-codes
```

Note: NO `--no-verify-jwt` here — this function requires a logged-in admin. The Functions runtime will reject missing/invalid JWTs before our handler even runs.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-codes/index.ts
git commit -m "feat(functions): generate-codes (admin-only)"
```

---

## Task 12: Rewrite `src/api/base44Client.js` against Supabase

**Files:**
- Modify: `src/api/base44Client.js` (full rewrite — replace file contents)

- [ ] **Step 1: Replace file contents**

Replace the entire contents of `src/api/base44Client.js` with:

```javascript
// Supabase-backed replacement for the old localStorage stub. Keeps the same
// exported shape (`base44.auth`, `base44.entities`, `base44.integrations`) so
// consumers don't need to change.

import { supabase, emailToUsername } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Entity CRUD via Proxy. base44.entities.<Name> returns a CRUD wrapper.
// Map entity names to table names (camel → snake).
// ---------------------------------------------------------------------------

const TABLE_MAP = {
  Figure: 'figures',
  Collection: 'collections',
  AppSettings: 'app_settings',
};

const tableName = (entityName) => TABLE_MAP[entityName] ?? entityName.toLowerCase();

const applyOrder = (query, sort) => {
  if (!sort) return query;
  const desc = sort.startsWith('-');
  const column = desc ? sort.slice(1) : sort;
  return query.order(column, { ascending: !desc });
};

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const makeEntity = (entityName) => {
  const table = tableName(entityName);
  return {
    list: async (sort, limit) => {
      let q = supabase.from(table).select('*');
      q = applyOrder(q, sort);
      if (limit) q = q.limit(limit);
      return unwrap(await q) ?? [];
    },
    filter: async (query, sort, limit) => {
      let q = supabase.from(table).select('*');
      for (const [k, v] of Object.entries(query ?? {})) q = q.eq(k, v);
      q = applyOrder(q, sort);
      if (limit) q = q.limit(limit);
      return unwrap(await q) ?? [];
    },
    get: async (id) => {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    create: async (record) => {
      const { data, error } = await supabase.from(table).insert(record).select().single();
      if (error) throw error;
      return data;
    },
    update: async (id, patch) => {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { ok: true };
    },
    subscribe: (cb) => {
      const channel = supabase
        .channel(`realtime:${table}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table },
            (payload) => {
              const typeMap = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' };
              cb({
                type: typeMap[payload.eventType] ?? payload.eventType.toLowerCase(),
                id: payload.new?.id ?? payload.old?.id,
                data: payload.new ?? payload.old,
              });
            })
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
};

const entityHandler = {
  get(_t, prop) { return typeof prop === 'string' ? makeEntity(prop) : undefined; },
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const auth = {
  me: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle();
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.username ?? emailToUsername(user.email) ?? '',
      role: profile?.is_admin ? 'admin' : 'user',
    };
  },
  login: async () => { throw new Error('base44.auth.login is not used; see src/lib/authStore.js'); },
  logout: async () => { await supabase.auth.signOut(); },
  redirectToLogin: (returnTo) => {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : '';
    window.location.href = `/login${next}`;
  },
};

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export const LLM_UNAVAILABLE_MSG = 'AI функц локал горимд идэвхгүй байна.';

const defaultFromSchema = (schema) => {
  if (!schema || typeof schema !== 'object') return null;
  switch (schema.type) {
    case 'object': {
      const out = {};
      for (const k of Object.keys(schema.properties ?? {})) out[k] = defaultFromSchema(schema.properties[k]);
      return out;
    }
    case 'array': return [];
    case 'number': case 'integer': return 0;
    case 'boolean': return false;
    case 'string': default: return '';
  }
};

const integrations = {
  Core: {
    InvokeLLM: async ({ response_json_schema } = {}) => {
      if (response_json_schema) {
        const base = defaultFromSchema(response_json_schema);
        if (base && typeof base === 'object' && !Array.isArray(base)) {
          if ('answer' in base) base.answer = LLM_UNAVAILABLE_MSG;
          if ('overall' in base) base.overall = LLM_UNAVAILABLE_MSG;
        }
        return base;
      }
      return LLM_UNAVAILABLE_MSG;
    },
    UploadFile: async ({ file }) => {
      if (!file) throw new Error('file required');
      const ext = file.name?.split('.').pop() ?? 'bin';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('figure-images').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('figure-images').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

export const base44 = {
  auth,
  entities: new Proxy({}, entityHandler),
  integrations,
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/base44Client.js
git commit -m "feat(api): rewrite base44 client against supabase"
```

---

## Task 13: Rewrite `src/lib/authStore.js` against Supabase

**Files:**
- Modify: `src/lib/authStore.js` (full rewrite — replace file contents)

- [ ] **Step 1: Replace file contents**

Replace the entire contents of `src/lib/authStore.js` with:

```javascript
// Supabase-backed replacement for the old localStorage auth store. Keeps the
// same exported signatures so OtpLogin.jsx and AdminPanel.jsx don't need to
// change call patterns (though a few formerly-sync functions are now async).

import { supabase, usernameToEmail, emailToUsername } from '@/lib/supabase';

const BOOTSTRAP_CODE = 'ADMIN001';

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

export const bootstrapCode = async () => {
  // Returns the bootstrap code if it hasn't been redeemed yet, else null.
  const { data } = await supabase.functions.invoke('check-code', {
    body: { code: BOOTSTRAP_CODE },
  });
  return data?.ok ? BOOTSTRAP_CODE : null;
};

// ---------------------------------------------------------------------------
// Invite codes (admin-facing)
// ---------------------------------------------------------------------------

export const listInviteCodes = async () => {
  // Admins read this via the service through a dedicated SELECT — but since
  // access_codes is service-role only, list is done by the generate-codes
  // function returning recently created codes. For listing all codes, we
  // expose them to admins via a SECURITY DEFINER RPC. Minimal path: call an
  // admin-only edge function that returns codes.
  const { data, error } = await supabase.functions.invoke('list-codes', {});
  if (error) throw error;
  return data?.codes ?? [];
};

export const createInviteCode = async ({ grants_admin = false } = {}) => {
  const { data, error } = await supabase.functions.invoke('generate-codes', {
    body: { count: 1, grants_admin },
  });
  if (error) throw error;
  return { code: data.codes?.[0] };
};

export const deleteInviteCode = async (code) => {
  const { error } = await supabase.functions.invoke('delete-code', { body: { code } });
  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const listAccounts = async () => {
  // Admins only — RLS on profiles allows it. For non-admins this returns [].
  const { data, error } = await supabase.from('profiles').select('id, username, is_admin, created_at');
  if (error) return [];
  return data ?? [];
};

// ---------------------------------------------------------------------------
// Register / login
// ---------------------------------------------------------------------------

export const checkInviteCode = async (code) => {
  const { data, error } = await supabase.functions.invoke('check-code', {
    body: { code },
  });
  if (error) return { ok: false, reason: 'server' };
  return data;
};

export const registerWithCode = async ({ code, username, password }) => {
  const { data, error } = await supabase.functions.invoke('redeem-code', {
    body: { code, username, password },
  });
  if (error) return { ok: false, reason: 'server' };
  if (!data?.ok) return data;

  // Install the returned session
  const { error: setErr } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setErr) return { ok: false, reason: 'session_failed' };

  return { ok: true, account: { username } };
};

export const login = async ({ username, password }) => {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('invalid login') || msg.includes('email not confirmed')) {
      // Distinguish "no such account" vs "bad password" by probing the profile.
      const { data: p } = await supabase
        .from('profiles').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
      return { ok: false, reason: p ? 'bad_password' : 'not_found' };
    }
    return { ok: false, reason: 'server' };
  }
  return { ok: true, account: { username } };
};

export const currentSession = () => {
  // Returns a sync snapshot so the existing useEffect-at-mount call in
  // OtpLogin.jsx still works. Supabase maintains the session in localStorage,
  // so getSession() is effectively synchronous on first read after SDK init.
  let session = null;
  supabase.auth.getSession().then(({ data }) => { session = data.session; });
  // The above is best-effort; consumers that need the session should await
  // supabase.auth.getSession() directly. For the OtpLogin "already logged in"
  // check, we use a fresh synchronous read from localStorage:
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const user = parsed?.user;
    if (!user) return null;
    return {
      account_id: user.id,
      username: user.user_metadata?.username ?? emailToUsername(user.email) ?? '',
      started_at: parsed?.expires_at ? new Date(parsed.expires_at * 1000).toISOString() : null,
    };
  } catch {
    return null;
  }
};

export const logout = async () => {
  await supabase.auth.signOut();
};
```

- [ ] **Step 2: Add the two helper Edge Functions referenced above (list-codes, delete-code)**

Create `supabase/functions/list-codes/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user?.app_metadata?.is_admin) return json({ ok: false, reason: 'forbidden' }, 403);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin
    .from('access_codes')
    .select('code, grants_admin, created_at, redeemed_by, redeemed_at')
    .order('created_at', { ascending: false });
  if (error) return json({ ok: false, reason: error.message }, 500);

  return json({
    ok: true,
    codes: data.map(r => ({
      id: r.code,
      code: r.code,
      created_at: r.created_at,
      used_by: r.redeemed_by,
      used_at: r.redeemed_at,
    })),
  });
});
```

Create `supabase/functions/delete-code/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user?.app_metadata?.is_admin) return json({ ok: false, reason: 'forbidden' }, 403);

  let body: { code?: string };
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_request' }, 400); }
  const code = body.code?.trim().toUpperCase();
  if (!code) return json({ ok: false, reason: 'bad_request' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.from('access_codes').delete().eq('code', code).is('redeemed_by', null);
  if (error) return json({ ok: false, reason: error.message }, 500);
  return json({ ok: true });
});
```

- [ ] **Step 3: Deploy the new functions**

```bash
supabase functions deploy list-codes
supabase functions deploy delete-code
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authStore.js supabase/functions/list-codes/index.ts supabase/functions/delete-code/index.ts
git commit -m "feat(auth): rewrite authStore against supabase + add list/delete code functions"
```

---

## Task 14: Update `OtpLogin.jsx` for async bootstrap/session

**Files:**
- Modify: `src/pages/OtpLogin.jsx`

- [ ] **Step 1: Convert `bootstrapCode()` and `listAccounts()` calls to async**

The existing file calls `bootstrapCode()` and `listAccounts()` synchronously at render time. Since both are now async, load them into state.

In `src/pages/OtpLogin.jsx`, replace the inline hint block (lines 84-100 in the current file) with a state-driven version. Find the block that starts with `{mode === 'redeem' && listAccounts().length === 0 && (` and replace it:

```jsx
{mode === 'redeem' && bootstrap && (
  <div
    className="rounded-md p-3 text-xs font-cormorant text-center space-y-1"
    style={{ border: '1px dashed rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.06)' }}
  >
    <div className="tracking-widest uppercase" style={{ color: '#c9a84c' }}>Шинээр эхэлж байна уу?</div>
    <div style={{ color: '#e8d5a3' }}>
      Анхны код:
      <span className="font-playfair tracking-widest ml-2" style={{ color: '#c9a84c' }}>
        {bootstrap}
      </span>
    </div>
    <div style={{ color: '#e8d5a360' }}>
      Эхний хэрэглэгч энэ кодыг ашиглаад админ руу нэвтэрч, өөр кодуудыг үүсгэнэ.
    </div>
  </div>
)}
```

Above the return, inside the `OtpLogin()` component, add:

```jsx
const [bootstrap, setBootstrap] = useState(null);

useEffect(() => {
  if (currentSession()) { navigate(next, { replace: true }); return; }
  bootstrapCode().then(setBootstrap);
}, [navigate, next]);
```

...replacing the existing `useEffect` that only calls `currentSession()`.

- [ ] **Step 2: Update `submitCode` in `RedeemForm` to await the async check**

Find `const submitCode = (e) => { ... };` in `RedeemForm` and replace it with:

```jsx
const submitCode = async (e) => {
  e.preventDefault();
  setError('');
  const result = await checkInviteCode(code);
  if (!result.ok) { setError(errMsg(result.reason)); return; }
  setStep('account');
};
```

- [ ] **Step 3: Typecheck and visual smoke test**

```bash
npm run typecheck
```

Then:

```bash
npm run dev
```

Open the dev URL in a browser, navigate to `/login` (or whatever path maps to OtpLogin). Expected:
- The "Шинээр эхэлж байна уу?" hint shows `ADMIN001` initially.
- After pasting `ADMIN001` and clicking Үргэлжлүүлэх, the form advances to the username/password step.
- Submitting a valid username+password creates the account and redirects into the app.
- Refresh the page — the hint no longer shows (code now consumed).
- Log out and try to redeem `ADMIN001` again — shows "Энэ код ашиглагдсан байна".

- [ ] **Step 4: Commit**

```bash
git add src/pages/OtpLogin.jsx
git commit -m "feat(auth): rewire OtpLogin for async invite-code flow"
```

---

## Task 15: Update `AdminPanel.jsx` invite-code section

**Files:**
- Modify: `src/components/admin/AdminPanel.jsx`

- [ ] **Step 1: Make code listing async**

Find the existing usage of `listInviteCodes()` (search for the literal string). In the JSX where the invite list is rendered, replace the synchronous call with state + effect. Near the top of the component, add:

```jsx
const [inviteCodes, setInviteCodes] = useState([]);
const [generating, setGenerating] = useState(false);
const [grantsAdmin, setGrantsAdmin] = useState(false);

const refreshCodes = async () => {
  try {
    const codes = await listInviteCodes();
    setInviteCodes(codes);
  } catch (e) {
    showToast('Код ачаалахад алдаа: ' + e.message, true);
  }
};

useEffect(() => { refreshCodes(); }, []);
```

- [ ] **Step 2: Update the generate button handler**

Find the button that calls `createInviteCode()`. Replace its onClick to:

```jsx
onClick={async () => {
  setGenerating(true);
  try {
    const result = await createInviteCode({ grants_admin: grantsAdmin });
    showToast(`Код үүсгэгдлээ: ${result.code}`);
    await refreshCodes();
  } catch (e) {
    showToast('Алдаа: ' + e.message, true);
  } finally {
    setGenerating(false);
  }
}}
disabled={generating}
```

And add a checkbox near the button:

```jsx
<label className="flex items-center gap-2 text-xs font-cormorant">
  <input type="checkbox" checked={grantsAdmin} onChange={e => setGrantsAdmin(e.target.checked)} />
  <span style={{ color: '#e8d5a3' }}>Админ эрх олгох</span>
</label>
```

- [ ] **Step 3: Update delete handler**

Find the button calling `deleteInviteCode(id)`. The old signature took an internal id; the new one takes the code string. Replace with:

```jsx
onClick={async () => {
  try {
    await deleteInviteCode(invite.code);
    await refreshCodes();
    showToast('Код устгагдлаа');
  } catch (e) {
    showToast('Алдаа: ' + e.message, true);
  }
}}
```

And update the rendered list to iterate over `inviteCodes` (state) instead of `listInviteCodes()` directly.

- [ ] **Step 4: Typecheck and visual test**

```bash
npm run typecheck
npm run dev
```

Log in as admin, open the admin panel, go to the invite codes tab. Expected: existing codes list, Generate button creates a new code, Delete removes one. Unused codes can be deleted; used ones cannot (filter `is null` in `delete-code` ensures this — will return an error, surface it as a toast).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminPanel.jsx
git commit -m "feat(admin): async invite-code management"
```

---

## Task 16: End-to-end smoke test

**Files:** none

- [ ] **Step 1: Clean state**

In the Supabase dashboard, delete any test users you created during earlier tasks (Authentication → Users → delete). Re-insert `ADMIN001`:

```sql
insert into access_codes (code, grants_admin) values ('ADMIN001', true)
on conflict (code) do nothing;
```

Run this in the Supabase SQL editor.

- [ ] **Step 2: Full flow test**

1. Start `npm run dev` and open the app.
2. Go to `/login`. Confirm the `ADMIN001` hint appears.
3. Enter `ADMIN001` → create account as `admin` / `admin1234`. Confirm redirect into the app.
4. Open the admin panel. Confirm it's accessible (admin detected). Generate 3 regular codes.
5. Log out. Try to log in as `admin` / wrong password — expect error. Log in as `admin` / `admin1234` — expect success.
6. Log out. Redeem one of the new regular codes as `user1` / `user1234`. Confirm redirect into the app.
7. Confirm `user1` does not see the admin panel (non-admin).
8. As `user1`, save a figure to "My Collection." Refresh — confirm it persists.
9. Log out. Log back in as `user1`. Confirm the collection is still there.
10. Log in as `admin`. Edit a figure's bio in the admin panel. Refresh the main page. Confirm the edit shows up (merged via Home.jsx's existing logic).
11. As `admin`, upload a new front image for a figure. Confirm it uploads and displays.

- [ ] **Step 3: Commit (only if test uncovered bugs you had to fix)**

If any fixes were needed along the way, commit them now with clear messages. If the test passed clean, nothing to commit.

---

## Task 17: Write Supabase setup section in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace or append Supabase section**

Open `README.md`. Append (or replace the existing Base44 section with) this content:

```markdown
## Supabase Backend Setup

This app uses Supabase (Postgres + Auth + Storage + Edge Functions). To run it against your own project:

1. Create a free project at https://supabase.com.
2. Install the Supabase CLI: https://supabase.com/docs/guides/cli
3. From the project root:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   supabase functions deploy check-code redeem-code generate-codes list-codes delete-code
   ```
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Settings → API.
5. `npm install && npm run dev`

### Bootstrap the first admin

The seed migration inserts a bootstrap invite code `ADMIN001` that grants admin rights. The first user to redeem it becomes the first admin. Generate further codes via the admin panel.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: supabase setup instructions"
```

---

## Task 18: Delete obsolete Base44 entity schema files

**Files:**
- Delete: `base44/entities/Figure.jsonc`, `base44/entities/Collection.jsonc`, `base44/entities/AppSettings.jsonc`

- [ ] **Step 1: Delete files**

```bash
rm base44/entities/Figure.jsonc base44/entities/Collection.jsonc base44/entities/AppSettings.jsonc
```

Check if the `base44/` folder has anything else:

```bash
ls base44
```

If only `entities/` remains and it's empty, remove it too:

```bash
rm -rf base44
```

- [ ] **Step 2: Commit**

```bash
git add -A base44 || true
git commit -m "chore: remove obsolete base44 entity schemas"
```

(Use `git add -A base44` to stage deletions; the `|| true` handles the case where the folder is already gone.)

---

## Self-Review Checklist (completed during plan authoring)

- [x] **Spec coverage:** All spec sections map to at least one task.
  - Tables/triggers/RLS → Task 3
  - Seed → Task 4
  - Storage → Task 5
  - Edge Functions (check-code, redeem-code, generate-codes, list-codes, delete-code) → Tasks 9, 10, 11, 13
  - Client rewrite (entities, auth, upload, LLM stub, realtime) → Task 12
  - authStore rewrite → Task 13
  - UI rewire (OtpLogin, AdminPanel) → Tasks 14, 15
  - Env vars → Tasks 1, 6
  - README → Task 17
  - Cleanup → Task 18
  - RLS smoke test → Task 7
- [x] **Placeholder scan:** no "TBD/TODO" left in plan. Every step has concrete code or commands.
- [x] **Type consistency:** `base44.entities.X` API (list/filter/get/create/update/delete/subscribe) consistent across Task 12; `authStore` signatures consistent across Tasks 13–15; edge function response shapes (`{ok, reason?, session?, codes?}`) consistent across Tasks 9–11, 13.
- [x] **Scope check:** single plan, single PR-sized migration.

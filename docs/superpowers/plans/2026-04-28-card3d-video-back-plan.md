# Card3D Video Back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The back face of `Card3D` becomes a user-controlled video player when an admin has uploaded a video for that figure.

**Architecture:** Admin-uploaded MP4 + WebVTT stored in a new Supabase Storage bucket (`figure-videos`); per-figure rows in a new `figure_back_videos` table. On the client, a hidden HTML `<video>` is the source of truth, a `THREE.VideoTexture` feeds the back face of the existing Card3D mesh, and DOM overlays render the play/replay/mute controls and caption strip. Lazy-init: nothing video-related is allocated until the user first clicks ▶ on a card.

**Tech Stack:** Supabase (Postgres + Storage + Edge Functions Deno), Three.js (existing), React 18, Vite, Vitest + jsdom, TanStack Query (existing).

---

## Spec

`docs/superpowers/specs/2026-04-28-card3d-video-back-design.md`

## File structure

**Create:**
- `supabase/migrations/20260428100000_figure_back_videos.sql` — table + RLS.
- `supabase/functions/upload-figure-back-video/index.ts` — admin-gated edge function with three actions: `upload-video`, `upload-captions`, `delete`.
- `src/lib/cardVideoLeader.js` — module-scoped "at most one playing video" registry.
- `src/lib/cardVideoLeader.test.js` — unit tests for the registry.
- `src/hooks/useFigureBackVideos.js` — TanStack Query hook returning `{[fig_id]: {url, captionsUrl, durationS}}`.
- `src/components/admin/BackVideos.jsx` — new admin sub-tab UI.
- `src/components/admin/BackVideos.test.jsx` — vitest tests.
- `src/components/Card3D.test.jsx` — new test file (none exists today).

**Modify:**
- `src/components/Card3D.jsx` — accept `back_video_url`, `back_captions_url`, `back_video_duration` from the figure object; add lazy `<video>` element + `VideoTexture` swap + DOM overlays + caption strip.
- `src/components/admin/AdminPanel.jsx` — add a new `<TabsTrigger value="back-videos">` and corresponding `<TabsContent>`.
- `src/lib/i18n.jsx` — add `card.video.*` and `admin.backVideos.*` keys (mn + en).
- `src/pages/Figures.jsx`, `src/pages/FigureDetail.jsx`, `src/components/GallerySection.jsx` (and any other Card3D consumers) — read `useFigureBackVideos()` and merge URLs into the figure objects passed to Card3D.

**Storage bucket setup:** the `figure-videos` bucket is created via the Supabase MCP `create_bucket` operation (or manual setup once) — documented in Task 1 Step 3 of this plan, not in a migration file.

---

## Task 1: Database migration + storage bucket

**Files:**
- Create: `supabase/migrations/20260428100000_figure_back_videos.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260428100000_figure_back_videos.sql
-- Per-figure back-of-card video + WebVTT captions, admin-uploaded.
create table if not exists public.figure_back_videos (
  fig_id        int  primary key,
  video_path    text not null,
  captions_path text,
  duration_s    real,
  uploaded_by   uuid references auth.users(id),
  uploaded_at   timestamptz not null default now()
);

alter table public.figure_back_videos enable row level security;

create policy "back_videos public read"
  on public.figure_back_videos for select using (true);

create policy "back_videos admin write"
  on public.figure_back_videos for all using (is_admin()) with check (is_admin());
```

- [ ] **Step 2: Apply migration via supabase MCP**

Use `mcp__supabase__apply_migration` with `name: "figure_back_videos"` and the SQL body above.

- [ ] **Step 3: Create the storage bucket via supabase MCP**

The supabase MCP doesn't have a dedicated `create_bucket` tool — use `mcp__supabase__execute_sql` to insert into the storage schema directly:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'figure-videos',
  'figure-videos',
  true,                                 -- public read
  52428800,                             -- 50 MB cap (matches client-side validation)
  array['video/mp4','text/vtt','text/plain']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Allow only service-role writes (edge functions); public reads work via the bucket public flag.
-- Anon and authenticated users can read but not write.
create policy if not exists "figure-videos public read"
  on storage.objects for select to public
  using (bucket_id = 'figure-videos');

-- Service role bypasses RLS so we don't need an explicit write policy; the edge function
-- handles all writes server-side. We deliberately do NOT create a write policy for
-- authenticated, so direct client uploads are blocked.
```

- [ ] **Step 4: Verify schema**

Run via `mcp__supabase__execute_sql`:

```sql
-- Confirm the table exists with the right columns
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'figure_back_videos'
order by ordinal_position;
-- Expect 6 rows: fig_id, video_path, captions_path, duration_s, uploaded_by, uploaded_at

-- Confirm the bucket exists and is public
select id, name, public, file_size_limit
from storage.buckets
where id = 'figure-videos';
-- Expect 1 row: figure-videos, figure-videos, true, 52428800

-- Confirm RLS is enabled and policies are in place
select polname from pg_policy where polrelid = 'public.figure_back_videos'::regclass;
-- Expect 2 rows: "back_videos public read", "back_videos admin write"
```

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add supabase/migrations/20260428100000_figure_back_videos.sql
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): figure_back_videos table + figure-videos storage bucket"
```

---

## Task 2: `upload-figure-back-video` edge function

**Files:**
- Create: `supabase/functions/upload-figure-back-video/index.ts`

- [ ] **Step 1: Write the edge function**

```ts
// supabase/functions/upload-figure-back-video/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;   // 50 MB
const MAX_CAPTIONS_BYTES = 100 * 1024;      // 100 KB
const MAX_DURATION_S = 60;
const BUCKET = 'figure-videos';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, reason: 'unauthorized' }, 401);
  }
  const userJwt = authHeader.slice(7).trim();
  if (!userJwt) return json({ ok: false, reason: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  // Verify caller is an admin.
  const { data: userResp, error: userErr } = await admin.auth.getUser(userJwt);
  if (userErr || !userResp.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userResp.user.id)
    .maybeSingle();
  if (profErr) return json({ ok: false, reason: 'server' }, 500);
  if (!profile?.is_admin) return json({ ok: false, reason: 'forbidden' }, 403);
  const adminUserId = userResp.user.id;

  // Parse the multipart body for upload actions; JSON for delete.
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.startsWith('multipart/form-data')) {
    const form = await req.formData();
    const action = String(form.get('action') ?? '');
    const figIdRaw = form.get('fig_id');
    const figId = Number(figIdRaw);
    if (!Number.isInteger(figId) || figId <= 0) return json({ ok: false, reason: 'bad_request' }, 400);

    if (action === 'upload-video') {
      const file = form.get('file');
      const durationSRaw = form.get('duration_s');
      const durationS = Number(durationSRaw);
      if (!(file instanceof File)) return json({ ok: false, reason: 'bad_request' }, 400);
      if (file.type !== 'video/mp4') return json({ ok: false, reason: 'bad_mime' }, 400);
      if (file.size > MAX_VIDEO_BYTES) return json({ ok: false, reason: 'too_large' }, 400);
      if (!Number.isFinite(durationS) || durationS <= 0 || durationS > MAX_DURATION_S) {
        return json({ ok: false, reason: 'too_long' }, 400);
      }

      // Read existing row to delete its old object before overwriting.
      const { data: existing } = await admin
        .from('figure_back_videos')
        .select('video_path')
        .eq('fig_id', figId)
        .maybeSingle();
      if (existing?.video_path) {
        await admin.storage.from(BUCKET).remove([existing.video_path]);
      }

      const newPath = `${figId}/back-${Date.now()}.mp4`;
      const buf = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from(BUCKET).upload(newPath, buf, {
        contentType: 'video/mp4',
        cacheControl: '2592000',
        upsert: false,
      });
      if (upErr) return json({ ok: false, reason: 'upload_failed', detail: upErr.message }, 500);

      const { error: rowErr } = await admin
        .from('figure_back_videos')
        .upsert({
          fig_id: figId,
          video_path: newPath,
          duration_s: durationS,
          uploaded_by: adminUserId,
          uploaded_at: new Date().toISOString(),
        }, { onConflict: 'fig_id' });
      if (rowErr) return json({ ok: false, reason: 'server', detail: rowErr.message }, 500);

      const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${newPath}`;
      return json({ ok: true, video_path: newPath, public_url: publicUrl });
    }

    if (action === 'upload-captions') {
      const file = form.get('file');
      if (!(file instanceof File)) return json({ ok: false, reason: 'bad_request' }, 400);
      if (file.type !== 'text/vtt' && file.type !== 'text/plain') {
        return json({ ok: false, reason: 'bad_mime' }, 400);
      }
      if (file.size > MAX_CAPTIONS_BYTES) return json({ ok: false, reason: 'too_large' }, 400);
      const text = await file.text();
      if (!text.trimStart().startsWith('WEBVTT')) {
        return json({ ok: false, reason: 'bad_format' }, 400);
      }

      const { data: existing } = await admin
        .from('figure_back_videos')
        .select('captions_path, video_path')
        .eq('fig_id', figId)
        .maybeSingle();
      if (!existing?.video_path) {
        return json({ ok: false, reason: 'no_video' }, 400);
      }
      if (existing.captions_path) {
        await admin.storage.from(BUCKET).remove([existing.captions_path]);
      }

      const newPath = `${figId}/back-${Date.now()}.vtt`;
      const buf = new TextEncoder().encode(text);
      const { error: upErr } = await admin.storage.from(BUCKET).upload(newPath, buf, {
        contentType: 'text/vtt',
        cacheControl: '2592000',
        upsert: false,
      });
      if (upErr) return json({ ok: false, reason: 'upload_failed', detail: upErr.message }, 500);

      const { error: rowErr } = await admin
        .from('figure_back_videos')
        .update({ captions_path: newPath })
        .eq('fig_id', figId);
      if (rowErr) return json({ ok: false, reason: 'server', detail: rowErr.message }, 500);

      const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${newPath}`;
      return json({ ok: true, captions_path: newPath, public_url: publicUrl });
    }

    return json({ ok: false, reason: 'bad_action' }, 400);
  }

  // JSON body — only for delete.
  const body: { action?: string; fig_id?: number } = await req.json().catch(() => ({}));
  if (body.action !== 'delete') return json({ ok: false, reason: 'bad_request' }, 400);
  const figId = Number(body.fig_id);
  if (!Number.isInteger(figId) || figId <= 0) return json({ ok: false, reason: 'bad_request' }, 400);

  const { data: existing } = await admin
    .from('figure_back_videos')
    .select('video_path, captions_path')
    .eq('fig_id', figId)
    .maybeSingle();
  if (existing) {
    const paths = [existing.video_path, existing.captions_path].filter((p): p is string => !!p);
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    await admin.from('figure_back_videos').delete().eq('fig_id', figId);
  }
  return json({ ok: true });
});
```

- [ ] **Step 2: Deploy via supabase MCP**

Use `mcp__supabase__deploy_edge_function`:
- `name`: `upload-figure-back-video`
- `files`: include `supabase/functions/upload-figure-back-video/index.ts` and `supabase/functions/_shared/cors.ts`.

- [ ] **Step 3: Verify deploy**

`mcp__supabase__list_edge_functions` — confirm `upload-figure-back-video` is listed and ACTIVE.
`mcp__supabase__get_edge_function` with `slug: 'upload-figure-back-video'` — confirm deployed source matches local file.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add supabase/functions/upload-figure-back-video/index.ts
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): upload-figure-back-video edge function"
```

---

## Task 3: `cardVideoLeader` module + tests

**Files:**
- Create: `src/lib/cardVideoLeader.js`
- Test: `src/lib/cardVideoLeader.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/cardVideoLeader.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('cardVideoLeader', () => {
  beforeEach(async () => {
    // Reset module state by re-importing fresh.
    vi.resetModules();
  });

  it('takes leadership when no other card is playing', async () => {
    const { takeLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    const pause = vi.fn();
    takeLeadership(1, pause);
    expect(getCurrentId()).toBe(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('pauses the previous leader when a new card takes over', async () => {
    const { takeLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    const pause1 = vi.fn();
    const pause2 = vi.fn();
    takeLeadership(1, pause1);
    takeLeadership(2, pause2);
    expect(getCurrentId()).toBe(2);
    expect(pause1).toHaveBeenCalledTimes(1);
    expect(pause2).not.toHaveBeenCalled();
  });

  it('does not pause the same card re-asserting leadership', async () => {
    const { takeLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    const pause = vi.fn();
    takeLeadership(1, pause);
    takeLeadership(1, pause);
    expect(getCurrentId()).toBe(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('releaseLeadership clears the leader if id matches', async () => {
    const { takeLeadership, releaseLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    takeLeadership(1, vi.fn());
    releaseLeadership(1);
    expect(getCurrentId()).toBeNull();
  });

  it('releaseLeadership is a no-op when id does not match', async () => {
    const { takeLeadership, releaseLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    takeLeadership(1, vi.fn());
    releaseLeadership(2);
    expect(getCurrentId()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test -- src/lib/cardVideoLeader.test.js
```

Expected: FAIL with "Cannot find module '@/lib/cardVideoLeader'".

- [ ] **Step 3: Write the module**

```js
// src/lib/cardVideoLeader.js
// Module-scoped singleton: at most one card video plays at a time.
let currentId = null;
let currentPause = null;

export function takeLeadership(id, pauseFn) {
  if (currentId !== null && currentId !== id && typeof currentPause === 'function') {
    try { currentPause(); } catch { /* ignore */ }
  }
  currentId = id;
  currentPause = pauseFn;
}

export function releaseLeadership(id) {
  if (currentId === id) {
    currentId = null;
    currentPause = null;
  }
}

export function getCurrentId() {
  return currentId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test -- src/lib/cardVideoLeader.test.js
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add src/lib/cardVideoLeader.js src/lib/cardVideoLeader.test.js
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): cardVideoLeader registry"
```

---

## Task 4: `useFigureBackVideos` hook

**Files:**
- Create: `src/hooks/useFigureBackVideos.js`

- [ ] **Step 1: Write the hook**

```js
// src/hooks/useFigureBackVideos.js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'figure-videos';

function publicUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export function useFigureBackVideos() {
  return useQuery({
    queryKey: ['figure_back_videos'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('figure_back_videos')
        .select('fig_id, video_path, captions_path, duration_s');
      if (error) throw error;
      const byId = {};
      for (const row of data ?? []) {
        byId[row.fig_id] = {
          url: publicUrl(row.video_path),
          captionsUrl: publicUrl(row.captions_path),
          durationS: row.duration_s,
        };
      }
      return byId;
    },
  });
}

// Helper: merge per-figure URLs into an array of figure objects.
export function mergeBackVideos(figures, byId) {
  if (!byId) return figures;
  return figures.map((f) => {
    const v = byId[f.fig_id];
    if (!v) return f;
    return {
      ...f,
      back_video_url: v.url,
      back_captions_url: v.captionsUrl,
      back_video_duration: v.durationS,
    };
  });
}
```

- [ ] **Step 2: Smoke-verify by importing once in dev console (no automated test)**

The hook is a thin wrapper around supabase + TanStack Query — both are well-tested upstream. Verify by including it in Task 8's Card3D test (which renders a figure with `back_video_url` set) — that's the integration check.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add src/hooks/useFigureBackVideos.js
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): useFigureBackVideos hook + merge helper"
```

---

## Task 5: i18n keys

**Files:**
- Modify: `src/lib/i18n.jsx`

- [ ] **Step 1: Append the keys**

Open `src/lib/i18n.jsx`, find the `STRINGS` object (large `export const STRINGS = { ... };` block). Append at the end of the object, just before its closing `};`:

```js
  // Card3D — video back
  'card.video.play':       { mn: 'Тоглуулах',   en: 'Play' },
  'card.video.replay':     { mn: 'Дахин',       en: 'Replay' },
  'card.video.mute':       { mn: 'Дуугүй',      en: 'Mute' },
  'card.video.unmute':     { mn: 'Дуутай',      en: 'Unmute' },

  // Admin — back videos tab
  'admin.backVideos.tab':       { mn: 'Видео',  en: 'Videos' },
  'admin.backVideos.upload':    { mn: 'Хуулах', en: 'Upload' },
  'admin.backVideos.replace':   { mn: 'Солих',  en: 'Replace' },
  'admin.backVideos.delete':    { mn: 'Устгах', en: 'Delete' },
  'admin.backVideos.captions':  { mn: 'Хадмал', en: 'Captions' },
  'admin.backVideos.tooBig':    { mn: 'Файл хэт том ({mb} MB > 50 MB)', en: 'File too large ({mb} MB > 50 MB)' },
  'admin.backVideos.tooLong':   { mn: 'Видео хэт урт ({s}s > 60s)',     en: 'Video too long ({s}s > 60s)' },
  'admin.backVideos.notVtt':    { mn: 'WEBVTT файл байх ёстой',         en: 'Must be a WEBVTT file' },
  'admin.backVideos.empty':     { mn: 'Видео байхгүй',                  en: 'No video' },
```

- [ ] **Step 2: Run tests to confirm no regression**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test
```

Expect all existing tests still pass (207 tests at the time of this plan; should be unchanged).

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add src/lib/i18n.jsx
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): i18n strings for video controls + admin tab"
```

---

## Task 6: `BackVideos` admin sub-component + tests

**Files:**
- Create: `src/components/admin/BackVideos.jsx`
- Create: `src/components/admin/BackVideos.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/admin/BackVideos.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockInvoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a) => mockInvoke(...a) } },
}));

vi.mock('@/lib/i18n', () => ({
  useLang: () => ({ t: (k) => k }),
}));

const FIGURES = [
  { fig_id: 1, name: 'Чингис Хаан', cat: 'khans', ico: '👑' },
  { fig_id: 2, name: 'Өгөдэй Хаан', cat: 'khans', ico: '👑' },
];

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('BackVideos', () => {
  it('renders all figures with empty status when no videos exist', async () => {
    const BackVideos = (await import('@/components/admin/BackVideos')).default;
    render(<BackVideos figures={FIGURES} videosById={{}} />);
    expect(screen.getByText('Чингис Хаан')).toBeInTheDocument();
    expect(screen.getByText('Өгөдэй Хаан')).toBeInTheDocument();
    expect(screen.getAllByText('admin.backVideos.empty')).toHaveLength(2);
  });

  it('renders uploaded status with duration for figures that have videos', async () => {
    const BackVideos = (await import('@/components/admin/BackVideos')).default;
    render(<BackVideos figures={FIGURES} videosById={{ 1: { url: 'https://x/b.mp4', captionsUrl: null, durationS: 42 } }} />);
    expect(screen.getByText(/0:42/)).toBeInTheDocument();
  });

  it('rejects an over-50-MB file client-side and does not call invoke', async () => {
    const BackVideos = (await import('@/components/admin/BackVideos')).default;
    const onChange = vi.fn();
    render(<BackVideos figures={FIGURES} videosById={{}} onChange={onChange} />);

    // The input is hidden behind the Upload button. Find it by data-testid.
    const input = screen.getAllByTestId('video-file-input')[0];
    const big = new File([new Uint8Array(60 * 1024 * 1024)], 'big.mp4', { type: 'video/mp4' });
    fireEvent.change(input, { target: { files: [big] } });

    await waitFor(() => {
      expect(screen.getByText(/admin\.backVideos\.tooBig/)).toBeInTheDocument();
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rejects a non-VTT captions file', async () => {
    const BackVideos = (await import('@/components/admin/BackVideos')).default;
    render(<BackVideos figures={FIGURES} videosById={{ 1: { url: 'https://x/b.mp4', captionsUrl: null, durationS: 30 } }} />);

    const input = screen.getByTestId('captions-file-input-1');
    const bad = new File(['just plain text'], 'bad.vtt', { type: 'text/plain' });
    Object.defineProperty(bad, 'text', { value: () => Promise.resolve('just plain text') });
    fireEvent.change(input, { target: { files: [bad] } });

    await waitFor(() => {
      expect(screen.getByText(/admin\.backVideos\.notVtt/)).toBeInTheDocument();
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('successful upload invokes the edge function', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, public_url: 'https://x/b.mp4' }, error: null });

    const BackVideos = (await import('@/components/admin/BackVideos')).default;
    const onChange = vi.fn();
    render(<BackVideos figures={FIGURES} videosById={{}} onChange={onChange} />);

    const input = screen.getAllByTestId('video-file-input')[0];
    const small = new File([new Uint8Array(1024)], 'ok.mp4', { type: 'video/mp4' });
    // Stub the duration check by mocking HTMLVideoElement.prototype.duration via a one-off element
    // — see the implementation note in Step 3.
    fireEvent.change(input, { target: { files: [small] } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('upload-figure-back-video', expect.objectContaining({
        body: expect.any(FormData),
      }));
    });
    expect(onChange).toHaveBeenCalled();
  });

  it('delete confirms then invokes with action=delete', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    window.confirm = vi.fn(() => true);

    const BackVideos = (await import('@/components/admin/BackVideos')).default;
    const onChange = vi.fn();
    render(<BackVideos figures={FIGURES} videosById={{ 1: { url: 'https://x/b.mp4', captionsUrl: null, durationS: 30 } }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /admin\.backVideos\.delete/ }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith('upload-figure-back-video', expect.objectContaining({
        body: expect.objectContaining({ action: 'delete', fig_id: 1 }),
      }));
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test -- src/components/admin/BackVideos.test.jsx
```

Expected: FAIL with "Cannot find module '@/components/admin/BackVideos'".

- [ ] **Step 3: Write the component**

```jsx
// src/components/admin/BackVideos.jsx
import { useRef, useState } from 'react';
import { Upload, RefreshCw, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_CAPTIONS_BYTES = 100 * 1024;
const MAX_DURATION_S = 60;

function formatDuration(s) {
  if (!Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

async function probeVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('probe_failed'));
    };
    v.src = url;
  });
}

export default function BackVideos({ figures, videosById = {}, onChange }) {
  const { t } = useLang();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // fig_id of currently-uploading row

  const handleVideoUpload = async (figId, file) => {
    setError('');
    if (file.type !== 'video/mp4') {
      setError(t('admin.backVideos.notVtt'));
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(t('admin.backVideos.tooBig', { mb: (file.size / 1024 / 1024).toFixed(1) }));
      return;
    }
    let durationS;
    try {
      durationS = await probeVideoDuration(file);
    } catch {
      setError('probe_failed');
      return;
    }
    if (durationS > MAX_DURATION_S) {
      setError(t('admin.backVideos.tooLong', { s: durationS.toFixed(1) }));
      return;
    }

    setBusy(figId);
    const form = new FormData();
    form.append('action', 'upload-video');
    form.append('fig_id', String(figId));
    form.append('duration_s', String(durationS));
    form.append('file', file);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-back-video', { body: form });
    setBusy(null);
    if (invErr || !data?.ok) {
      setError(data?.reason || invErr?.message || 'server');
      return;
    }
    onChange?.();
  };

  const handleCaptionsUpload = async (figId, file) => {
    setError('');
    if (file.size > MAX_CAPTIONS_BYTES) {
      setError(t('admin.backVideos.tooBig', { mb: (file.size / 1024 / 1024).toFixed(2) }));
      return;
    }
    const text = await file.text();
    if (!text.trimStart().startsWith('WEBVTT')) {
      setError(t('admin.backVideos.notVtt'));
      return;
    }
    setBusy(figId);
    const form = new FormData();
    form.append('action', 'upload-captions');
    form.append('fig_id', String(figId));
    form.append('file', file);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-back-video', { body: form });
    setBusy(null);
    if (invErr || !data?.ok) {
      setError(data?.reason || invErr?.message || 'server');
      return;
    }
    onChange?.();
  };

  const handleDelete = async (figId) => {
    if (!window.confirm(t('admin.backVideos.delete') + '?')) return;
    setBusy(figId);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-back-video', {
      body: { action: 'delete', fig_id: figId },
    });
    setBusy(null);
    if (invErr || !data?.ok) {
      setError(data?.reason || invErr?.message || 'server');
      return;
    }
    onChange?.();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="px-3 py-2 rounded bg-red-950/50 border border-red-500 text-sm text-red-200">
          {error}
        </div>
      )}
      <ScrollArea className="h-[60vh]">
        <div className="space-y-2">
          {figures.map((f) => {
            const v = videosById[f.fig_id];
            return (
              <BackVideoRow
                key={f.fig_id}
                figure={f}
                video={v}
                busy={busy === f.fig_id}
                onUploadVideo={(file) => handleVideoUpload(f.fig_id, file)}
                onUploadCaptions={(file) => handleCaptionsUpload(f.fig_id, file)}
                onDelete={() => handleDelete(f.fig_id)}
                t={t}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function BackVideoRow({ figure, video, busy, onUploadVideo, onUploadCaptions, onDelete, t }) {
  const videoRef = useRef(null);
  const captionsRef = useRef(null);

  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
      <span className="text-xl w-8 text-center">{figure.ico}</span>
      <div className="flex-1 min-w-0">
        <div className="font-cinzel text-sm font-bold truncate">{figure.name}</div>
        <div className="text-xs text-muted-foreground font-body">
          {video ? (
            <>
              ✓ {formatDuration(video.durationS)} {video.captionsUrl && '· cc'}
            </>
          ) : (
            t('admin.backVideos.empty')
          )}
        </div>
      </div>
      <input
        type="file"
        accept="video/mp4"
        className="hidden"
        ref={videoRef}
        data-testid="video-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadVideo(f);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        accept=".vtt,text/vtt,text/plain"
        className="hidden"
        ref={captionsRef}
        data-testid={`captions-file-input-${figure.fig_id}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadCaptions(f);
          e.target.value = '';
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => videoRef.current?.click()}
        className="gap-1"
      >
        {video ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
        {video ? t('admin.backVideos.replace') : t('admin.backVideos.upload')}
      </Button>
      {video && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => captionsRef.current?.click()}
          className="gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          {t('admin.backVideos.captions')}
        </Button>
      )}
      {video && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onDelete}
          className="gap-1 text-red-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('admin.backVideos.delete')}
        </Button>
      )}
    </div>
  );
}
```

**Implementation note for the upload-success test:** the test passes a 1024-byte File but the production code calls `probeVideoDuration` which creates a real `<video>` element. In jsdom, `<video>.duration` is `NaN` and `loadedmetadata` may not fire. To make the test pass deterministically, mock `probeVideoDuration` indirectly by stubbing `HTMLMediaElement.prototype` properties. Or — simpler — extract `probeVideoDuration` to a separate small module (`src/lib/videoMeta.js`) and mock that module in the test:

```js
vi.mock('@/lib/videoMeta', () => ({ probeVideoDuration: vi.fn().mockResolvedValue(30) }));
```

If you take this path, also export `probeVideoDuration` from the new module instead of inline in BackVideos.jsx, and import it. This is cleaner and is what the test in Step 1 implicitly assumes. Apply this refactor before the test passes.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test -- src/components/admin/BackVideos.test.jsx
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add src/components/admin/BackVideos.jsx src/components/admin/BackVideos.test.jsx src/lib/videoMeta.js
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): admin BackVideos tab UI"
```

---

## Task 7: Wire BackVideos tab into AdminPanel

**Files:**
- Modify: `src/components/admin/AdminPanel.jsx`

- [ ] **Step 1: Add the imports + tab**

In `src/components/admin/AdminPanel.jsx`:

(a) Add import alongside existing admin sub-component imports (around line 14-17):

```js
import BackVideos from '@/components/admin/BackVideos';
import { useFigureBackVideos } from '@/hooks/useFigureBackVideos';
```

(b) Inside the `AdminPanel` component body (after `useAppSettings` setup), call the hook:

```js
const { data: videosById, refetch: refetchVideos } = useFigureBackVideos();
```

(c) In the `<TabsList>` (around line 280-303), add a new trigger after the `eras` tab:

```jsx
<TabsTrigger value="back-videos" className="gap-1.5 text-xs font-body">
  🎬 Видео
</TabsTrigger>
```

(d) Add the corresponding `<TabsContent>` block after the existing `<TabsContent value="eras">` (find it by searching for `value="eras"`):

```jsx
<TabsContent value="back-videos" className="flex-1 overflow-auto p-6">
  <BackVideos
    figures={figures}
    videosById={videosById ?? {}}
    onChange={() => refetchVideos()}
  />
</TabsContent>
```

- [ ] **Step 2: Run the existing AdminPanel test to confirm no regression**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test -- src/components/admin/AdminPanel.test.jsx
```

Expected: existing AdminPanel tests still pass.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add src/components/admin/AdminPanel.jsx
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): wire BackVideos tab into AdminPanel"
```

---

## Task 8: Card3D extension + tests

**Files:**
- Modify: `src/components/Card3D.jsx`
- Create: `src/components/Card3D.test.jsx`

This is the biggest task because it touches a 397-line existing file with a Three.js lifecycle. Read `src/components/Card3D.jsx` start-to-finish before touching it. Key extension points:

- `figure` prop now optionally has `back_video_url`, `back_captions_url`, `back_video_duration`.
- The existing `useEffect` that builds the Three.js scene (lines 144-289 of the current file) needs a video lifecycle alongside the existing texture lifecycle.
- DOM overlay JSX is added inside the existing return JSX, alongside the existing `mountRef` div.

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/Card3D.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Three.js needs WebGL which jsdom doesn't have. Mock it minimally.
vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  class MockRenderer {
    constructor() { this.domElement = document.createElement('canvas'); }
    setSize() {}
    setPixelRatio() {}
    setClearColor() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }
  return {
    ...actual,
    WebGLRenderer: MockRenderer,
  };
});

vi.mock('@/lib/cardVideoLeader', () => ({
  takeLeadership: vi.fn(),
  releaseLeadership: vi.fn(),
  getCurrentId: vi.fn(),
}));

const figureNoVideo = {
  fig_id: 1, cat: 'khans', ico: '👑', card: 'Туз', name: 'Чингис Хаан',
  yrs: '1162-1227', role: 'X', bio: 'Y', achs: [], fact: '', quote: null, qattr: null, rel: [],
};

const figureWithVideo = {
  ...figureNoVideo,
  back_video_url: 'https://x/back.mp4',
  back_captions_url: 'https://x/back.vtt',
  back_video_duration: 30,
};

beforeEach(() => {
  // Force IntersectionObserver to report intersecting immediately.
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ isIntersecting: true, intersectionRatio: 1, target: el }]); }
    disconnect() {}
  };
});

describe('Card3D back video', () => {
  it('does not create a <video> element when no back_video_url is set', async () => {
    const Card3D = (await import('@/components/Card3D')).default;
    render(<Card3D figure={figureNoVideo} onClick={() => {}} />);
    expect(document.querySelector('video[data-card-video]')).toBeNull();
  });

  it('shows a play overlay when back_video_url is set and card is flipped', async () => {
    const Card3D = (await import('@/components/Card3D')).default;
    render(<Card3D figure={figureWithVideo} onClick={() => {}} />);

    // Flip the card.
    fireEvent.click(screen.getByRole('button', { name: /Ар|Нүүр/ }));

    await waitFor(() => {
      expect(screen.getByTestId('card-video-play')).toBeInTheDocument();
    });
  });

  it('clicking play creates a <video> element and calls play()', async () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();

    const Card3D = (await import('@/components/Card3D')).default;
    render(<Card3D figure={figureWithVideo} onClick={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Ар|Нүүр/ }));
    fireEvent.click(await screen.findByTestId('card-video-play'));

    await waitFor(() => {
      const video = document.querySelector('video[data-card-video]');
      expect(video).toBeTruthy();
      expect(video.src).toContain('back.mp4');
    });
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it('mute toggle flips videoEl.muted', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();

    const Card3D = (await import('@/components/Card3D')).default;
    render(<Card3D figure={figureWithVideo} onClick={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Ар|Нүүр/ }));
    fireEvent.click(await screen.findByTestId('card-video-play'));

    const muteBtn = await screen.findByTestId('card-video-mute');
    fireEvent.click(muteBtn);

    const video = document.querySelector('video[data-card-video]');
    expect(video.muted).toBe(true);
  });

  it('replay button appears after ended event', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();

    const Card3D = (await import('@/components/Card3D')).default;
    render(<Card3D figure={figureWithVideo} onClick={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Ар|Нүүр/ }));
    fireEvent.click(await screen.findByTestId('card-video-play'));

    const video = document.querySelector('video[data-card-video]');
    fireEvent.ended(video);

    expect(await screen.findByTestId('card-video-replay')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test -- src/components/Card3D.test.jsx
```

Expected: 5 tests FAIL (Card3D doesn't yet handle back_video_url).

- [ ] **Step 3: Extend Card3D.jsx**

Open `src/components/Card3D.jsx`. Make the following changes:

(a) Add imports at the top, after the existing `import StoryPlayer ...`:

```js
import { takeLeadership, releaseLeadership } from '@/lib/cardVideoLeader';
```

(b) In the function body, add new refs and state:

```js
const videoElRef = useRef(null);
const videoTexRef = useRef(null);
const captionStripRef = useRef(null);
const [videoState, setVideoState] = useState('no_video'); // 'no_video' | 'ready' | 'playing' | 'ended'
const [muted, setMuted] = useState(false);
const [activeCueText, setActiveCueText] = useState('');
const [overlayVisible, setOverlayVisible] = useState(false);
```

Initialize `videoState` based on `figure.back_video_url`:

```js
useEffect(() => {
  setVideoState(figure.back_video_url ? 'ready' : 'no_video');
}, [figure.back_video_url]);
```

(c) Inside the existing rAF `animate` function (around line 248), after the existing rotation lerp, compute and update the overlay visibility flag (throttled — only update React state when the boolean flips):

```js
const showingBack =
  Math.abs(((card.rotation.y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.20;
const nextVisible = showingBack && !isDraggingRef.current;
if (nextVisible !== overlayVisibleRef.current) {
  overlayVisibleRef.current = nextVisible;
  setOverlayVisible(nextVisible);
}
```

Add `const overlayVisibleRef = useRef(false);` alongside the other refs.

(d) Add a `playVideo()` function in the component body:

```js
const playVideo = () => {
  if (!figure.back_video_url) return;
  let videoEl = videoElRef.current;
  if (!videoEl) {
    videoEl = document.createElement('video');
    videoEl.setAttribute('data-card-video', '');
    videoEl.setAttribute('crossorigin', 'anonymous');
    videoEl.setAttribute('playsinline', '');
    videoEl.preload = 'metadata';
    videoEl.style.display = 'none';
    videoEl.src = figure.back_video_url;
    if (figure.back_captions_url) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.src = figure.back_captions_url;
      track.default = true;
      videoEl.appendChild(track);
    }
    document.body.appendChild(videoEl);
    videoElRef.current = videoEl;

    // Hook ended event
    videoEl.addEventListener('ended', () => {
      setVideoState('ended');
      releaseLeadership(figure.fig_id);
    });

    // Cuechange handler — populate the caption strip.
    if (videoEl.textTracks && videoEl.textTracks[0]) {
      videoEl.textTracks[0].mode = 'hidden';
      videoEl.textTracks[0].oncuechange = () => {
        const cues = videoEl.textTracks[0].activeCues;
        const text = cues && cues.length
          ? Array.from(cues).map((c) => c.text).join(' ')
          : '';
        setActiveCueText(text);
      };
    }

    // Build VideoTexture and swap it onto materials[5].map
    const tex = new THREE.VideoTexture(videoEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    videoTexRef.current = tex;
    const card = cardRef.current;
    if (card) {
      card.material[5].map = tex;
      card.material[5].needsUpdate = true;
    }
  } else {
    videoEl.currentTime = 0;
  }
  takeLeadership(figure.fig_id, () => {
    videoEl.pause();
    setVideoState('ended');
  });
  videoEl.muted = muted;
  videoEl.play().catch(() => { /* user gesture missing or codec issue */ });
  setVideoState('playing');
};
```

(e) Add the cleanup-on-unmount and visibility-teardown logic. In the existing main `useEffect` cleanup (the function returned at the bottom), append:

```js
const videoEl = videoElRef.current;
if (videoEl) {
  videoEl.pause();
  videoEl.removeAttribute('src');
  try { videoEl.load(); } catch { /* ignore */ }
  if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
  videoElRef.current = null;
}
if (videoTexRef.current) {
  videoTexRef.current.dispose();
  videoTexRef.current = null;
}
releaseLeadership(figure.fig_id);
```

Add a separate `useEffect` that watches `isInView`:

```js
useEffect(() => {
  if (isInView) return;
  // Card scrolled out — release video resources.
  const videoEl = videoElRef.current;
  if (videoEl) {
    videoEl.pause();
    videoEl.removeAttribute('src');
    try { videoEl.load(); } catch { /* ignore */ }
    if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
    videoElRef.current = null;
  }
  if (videoTexRef.current) {
    videoTexRef.current.dispose();
    videoTexRef.current = null;
  }
  releaseLeadership(figure.fig_id);
  setVideoState(figure.back_video_url ? 'ready' : 'no_video');
}, [isInView, figure.back_video_url, figure.fig_id]);
```

(f) Add the DOM overlay JSX inside the existing return — insert AFTER the `<div ref={mountRef} ... />` element, but still inside the same wrapper:

```jsx
{figure.back_video_url && overlayVisible && (
  <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ height: '340px', top: 0 }}>
    {videoState === 'ready' && (
      <button
        type="button"
        data-testid="card-video-play"
        onClick={playVideo}
        className="pointer-events-auto w-16 h-16 rounded-full bg-black/60 border-2 border-gold flex items-center justify-center hover:bg-black/80 transition-all"
        aria-label={t('card.video.play')}
      >
        <span className="text-3xl text-gold">▶</span>
      </button>
    )}
    {videoState === 'ended' && (
      <button
        type="button"
        data-testid="card-video-replay"
        onClick={playVideo}
        className="pointer-events-auto w-16 h-16 rounded-full bg-black/60 border-2 border-gold flex items-center justify-center hover:bg-black/80 transition-all"
        aria-label={t('card.video.replay')}
      >
        <span className="text-3xl text-gold">↻</span>
      </button>
    )}
    {videoState === 'playing' && (
      <>
        <button
          type="button"
          data-testid="card-video-mute"
          onClick={() => {
            const v = videoElRef.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
          }}
          className="pointer-events-auto absolute bottom-2 right-2 w-9 h-9 rounded-full bg-black/60 border border-gold flex items-center justify-center hover:bg-black/80"
          aria-label={muted ? t('card.video.unmute') : t('card.video.mute')}
        >
          <span className="text-sm text-gold">{muted ? '🔇' : '🔊'}</span>
        </button>
        {muted && activeCueText && (
          <div className="absolute bottom-12 left-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-body text-center rounded">
            {activeCueText}
          </div>
        )}
      </>
    )}
  </div>
)}
```

Add `const { t } = useLang();` near the top of the component body if not already present, and import `useLang` from `@/lib/i18n`.

(g) The wrapper `<div className="flex flex-col items-center select-none" ref={wrapperRef}>` may need to become `relative` so the absolute overlay positions correctly. Change to:

```jsx
<div className="relative flex flex-col items-center select-none" ref={wrapperRef}>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test -- src/components/Card3D.test.jsx
```

Expected: all 5 tests PASS.

If a test fails for jsdom reasons (e.g., `IntersectionObserver`, `HTMLMediaElement.prototype.play`), tighten the mock setup in `beforeEach`. Do not commit broken tests — escalate via DONE_WITH_CONCERNS if you can't get them green within 30 minutes.

- [ ] **Step 5: Run full suite — confirm no regression in other tests**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test
```

Expected: full suite green (was 207; should be 207 + 6 (BackVideos) + 5 (cardVideoLeader) + 5 (Card3D) = ~223).

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add src/components/Card3D.jsx src/components/Card3D.test.jsx
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): video back face with play/mute/captions overlay"
```

---

## Task 9: Wire video URLs through gallery pages + final verification

**Files:**
- Modify: `src/pages/Figures.jsx`
- Modify: `src/pages/FigureDetail.jsx`
- Modify: `src/components/GallerySection.jsx`

- [ ] **Step 1: Update each Card3D consumer to merge in video URLs**

For each of `Figures.jsx`, `FigureDetail.jsx`, `GallerySection.jsx`:

(a) Add the hook import:

```js
import { useFigureBackVideos, mergeBackVideos } from '@/hooks/useFigureBackVideos';
```

(b) In the component body, call the hook and merge:

```js
const { data: videosById } = useFigureBackVideos();
const figuresWithVideos = useMemo(
  () => mergeBackVideos(figures /* or whatever variable holds the figure list */, videosById),
  [figures, videosById],
);
```

(c) Replace the variable passed to `Card3D` (and any `.map(...)` over figures that creates Card3Ds) to use `figuresWithVideos` instead.

`useMemo` should already be imported in each of these files; if not, add it.

- [ ] **Step 2: Run the full test suite**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run test
```

Expected: full suite green.

- [ ] **Step 3: Run lint**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run lint
```

Expected: no NEW errors. (Pre-existing errors in unrelated files — `GallerySection.jsx`, `HistoricalMap.jsx`, etc. — are documented carry-overs from before this branch and may stay.)

- [ ] **Step 4: Production build**

```bash
npm --prefix "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" run build
```

Expected: clean build.

- [ ] **Step 5: Manual smoke test**

1. Sign in as an admin. Open AdminPanel → Видео tab. Verify list of all 52 figures with — status.
2. Pick a 30-second MP4 you have locally. Upload for figure 1 (Чингис Хаан). Watch for ✓ 0:30 status update.
3. Optionally upload a `.vtt` file for the same figure. Watch for · cc badge.
4. Open the public site (`/figures` or whichever page renders Card3D). Flip card 1 to back. ▶ overlay appears.
5. Click ▶ → video plays with audio. 🔊 mute button visible.
6. Click 🔊 → video mutes. If captions uploaded, caption strip appears at bottom; cues sync. Click again to unmute.
7. Let video end → last frame stays, replay button appears. Click → plays from start.
8. Drag-rotate the card → all overlays disappear during rotation.
9. Scroll card 1 off-screen → DevTools Network: video request canceled.
10. Open card 1, then quickly click play on card 2 (after uploading a video to card 2 too) → card 1 auto-pauses.
11. Admin replaces card 1's video → public users see the new video on next page load.
12. Admin deletes card 1's video → public site reverts to static back canvas; ▶ overlay absent.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" add src/pages/Figures.jsx src/pages/FigureDetail.jsx src/components/GallerySection.jsx
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)" commit -m "feat(card3d): thread back-video URLs through gallery pages"
```

- [ ] **Step 7: Update memory after merge**

Add a memory entry similar to existing `single_device_signin_shipped.md` summarising what shipped, total tests, any gotchas (especially around storage budget — 52 × 50 MB worst case).

---

## Self-review notes

- **Spec coverage:**
  - Schema → Task 1.
  - Storage bucket → Task 1 Step 3.
  - Edge fn `upload-figure-back-video` → Task 2.
  - Read-side hook → Task 4.
  - `cardVideoLeader` → Task 3.
  - i18n → Task 5.
  - AdminPanel UI → Task 6 + Task 7.
  - Card3D extension → Task 8.
  - Wiring through gallery pages → Task 9.
  - Manual test plan → Task 9 Step 5.

- **Placeholder scan:** none.
- **Type consistency:** field names (`fig_id`, `video_path`, `captions_path`, `duration_s`, `back_video_url`, `back_captions_url`, `back_video_duration`) are stable across tasks. The hook output shape (`{url, captionsUrl, durationS}`) is consistent in every consumer.
- **TDD discipline:** Tasks 3, 6, 8 follow strict TDD. Tasks 1, 2, 4, 5, 7, 9 are infrastructure / wiring; tests for them are integration-level via Task 8's Card3D suite + Task 6's BackVideos suite.
- **Storage budget caveat:** 52 figures × 50 MB worst case = 2.6 GB. Supabase free tier is 1 GB. Worth flagging during smoke test if uploading more than ~20 figures.

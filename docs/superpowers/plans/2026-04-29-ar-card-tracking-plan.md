# AR Card Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WebAR feature where tapping an "AR харах" button on a figure opens the camera, MindAR detects the physical playing card, and the existing per-figure MP4 plays as a flat video plane locked to the card surface.

**Architecture:** New OtpGated lazy-loaded route `/ar/:figId`. Reuses the existing `figure_back_videos` table + `figure-videos` storage bucket from the 2026-04-28 video-back work — adds a single `ar_target_path` column for the admin-uploaded MindAR `.mind` target. New `<MindARScene>` component imperatively builds an A-Frame scene via DOM APIs (no JSX inside the AR scene), so the React tree never tries to reconcile A-Frame's custom elements. Desktop visitors see a QR-code fallback that points at their phone.

**Tech Stack:** React 18 + react-router-dom 6, A-Frame 1.5 + mind-ar 1.2 (dynamic-imported, code-split), Supabase (Postgres + Storage + edge functions in Deno), TanStack Query 5, Vitest 2 + jsdom, Tailwind, framer-motion, qrcode.

**Spec divergences (locked in):**
- The spec writes the bucket as `figure-back-videos`; the actual bucket from the 2026-04-28 work is **`figure-videos`** (see `src/hooks/useFigureBackVideos.js:5` and `supabase/functions/upload-figure-back-video/index.ts:7`). Use `figure-videos` everywhere.
- The spec mentions a `useT` hook; the codebase uses `useLang()` returning `{ t, lang, setLang }` (see `src/lib/i18n.jsx`). Use that.
- The spec puts the compact AR button "on `Card3D` in `/collection`" — but `/collection` is a plain link grid (`src/pages/Collection.jsx`) that does not render `Card3D`. `Card3D` is mounted by `GallerySection` (Home/Codex page). Putting the compact button **on the `Card3D` component itself** automatically gives it everywhere `Card3D` renders, which is the spec's intent.
- Storage path uses a timestamped filename `target-{ts}.mind` (matching `back-{ts}.mp4` in the existing edge function) instead of plain `target.mind`, so atomic replace with delete-after-upload still works.
- Edge function tests are not part of the suite (the existing `upload-figure-back-video` has no `.test.ts`), so we do not add one for `upload-figure-ar-target` either; admin-side coverage comes from `ARTargetUploader.test.jsx` which mocks `supabase.functions.invoke`.

---

## File Structure

**New files:**
- `supabase/migrations/20260429000000_ar_target_column.sql` — adds `ar_target_path text` column to `figure_back_videos`
- `supabase/functions/upload-figure-ar-target/index.ts` — admin upload + delete edge function for `.mind` targets
- `src/hooks/useFigureARTarget.js` + `.test.js` — read-side hook returning `{ ready, videoUrl, targetUrl, loading, error }` for one figure
- `src/components/ARLaunchButton.jsx` + `.test.jsx` — `variant="full" | "compact"` launch button with gold-pulse styling
- `src/components/ar/DesktopFallback.jsx` + `.test.jsx` — QR-code panel pointing at the phone URL
- `src/components/ar/MindARScene.jsx` — imperative A-Frame + MindAR scene (not unit-tested; jsdom can't run WebGL)
- `src/pages/ARView.jsx` + `.test.jsx` — page that branches loading / desktop / mobile-ready / mobile-missing
- `src/components/admin/ARTargetUploader.jsx` + `.test.jsx` — admin tab body listing all figures with upload-`.mind` action

**Modified files:**
- `src/lib/i18n.jsx` — add `ar.*` and `admin.arTargets.*` strings
- `src/App.jsx` — add lazy-loaded `/ar/:figId` route under `OtpGate`
- `src/pages/FigureDetail.jsx` — add full-variant `<ARLaunchButton>` to the top action row
- `src/components/Card3D.jsx` — overlay compact `<ARLaunchButton>` top-right of the 3D card
- `src/hooks/useFigureBackVideos.js` — also select `ar_target_path` so `<ARTargetUploader>` and `<ARLaunchButton compact>` can read it without a second query
- `src/components/admin/AdminPanel.jsx` — add new tab "AR" wiring up `<ARTargetUploader>`
- `package.json` — add `aframe@^1.5.0`, `mind-ar@^1.2.5`, `qrcode@^1.5.3` (qrcode is referenced in the spec but not in the lockfile — verify in Task 13.1; install only if missing)

**Boundaries:**
- Reading AR availability for a single figure → `useFigureARTarget(figId)` (cheap, cached, used by every button instance).
- Reading AR availability for all figures → `useFigureBackVideos()` extended with `ar_target_path` (used by admin table only, one query).
- AR scene mount/teardown lives entirely in `MindARScene` so the rest of the app never imports A-Frame.

---

## Task 0: Worktree + branch hygiene

- [ ] **Step 1: Create worktree for this feature** — Skip if already in a dedicated worktree. Otherwise:

```bash
git -C "C:/Users/enkh/Downloads/project/mongol-history-hub (2)/" worktree add -b feat/ar-card-tracking ../ar-card-tracking master
```

- [ ] **Step 2: Verify clean baseline** — Run `git -C "<repo>" status` and the test suite.

```bash
npm test -- --run
```
Expected: 223 tests passing (per memory entry "card3d_video_back_shipped").

- [ ] **Step 3: Skip ahead if dirty** — If tests fail at baseline, stop and fix or surface to the user before continuing.

---

## Task 1: Migration — add `ar_target_path` column

**Files:**
- Create: `supabase/migrations/20260429000000_ar_target_column.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260429000000_ar_target_column.sql
-- Adds the MindAR .mind target file path to the existing per-figure back-video table.
-- A figure is "AR-ready" iff both video_path and ar_target_path are non-null.
alter table public.figure_back_videos
  add column if not exists ar_target_path text;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with `name: 'ar_target_column'` and the SQL body above. This both runs the migration on the project database and registers it in the migrations history.

- [ ] **Step 3: Verify the column exists**

Use `mcp__supabase__execute_sql` with:

```sql
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'figure_back_videos'
   and column_name  = 'ar_target_path';
```
Expected: one row, `ar_target_path | text`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260429000000_ar_target_column.sql
git commit -m "feat(ar): add ar_target_path column to figure_back_videos"
```

---

## Task 2: Extend `useFigureBackVideos` to expose `ar_target_path`

**Files:**
- Modify: `src/hooks/useFigureBackVideos.js`

- [ ] **Step 1: Add `ar_target_path` to the select + map**

Replace the existing query block. Final file:

```js
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
        .select('fig_id, video_path, captions_path, ar_target_path, duration_s');
      if (error) throw error;
      const byId = {};
      for (const row of data ?? []) {
        byId[row.fig_id] = {
          url: publicUrl(row.video_path),
          captionsUrl: publicUrl(row.captions_path),
          arTargetUrl: publicUrl(row.ar_target_path),
          arTargetPath: row.ar_target_path,
          durationS: row.duration_s,
        };
      }
      return byId;
    },
  });
}

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
      ar_target_url: v.arTargetUrl,
    };
  });
}
```

- [ ] **Step 2: Run existing tests to ensure nothing regressed**

```bash
npm test -- --run
```
Expected: still green (222–223 tests). The hook itself doesn't have a test, but every page that consumes it (Card3D, FigureDetail's video back, BackVideos admin) is covered.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFigureBackVideos.js
git commit -m "feat(ar): expose ar_target_url from useFigureBackVideos"
```

---

## Task 3: i18n strings for AR + admin AR uploader

**Files:**
- Modify: `src/lib/i18n.jsx`

- [ ] **Step 1: Add the strings**

Find the `STRINGS` object and add these keys (group near `admin.backVideos.*` for consistency). Place inside the `STRINGS = { ... }` literal:

```jsx
  // AR feature — public
  'ar.button.full':           { mn: 'AR харах',                              en: 'View in AR' },
  'ar.button.compact':        { mn: 'AR',                                    en: 'AR' },
  'ar.button.comingSoon':     { mn: 'AR — Тун удахгүй',                      en: 'AR — Coming soon' },
  'ar.button.tooltipDisabled':{ mn: 'Энэ дүрд AR удахгүй нэмэгдэнэ',         en: 'AR will be added for this figure soon' },
  'ar.loading':               { mn: 'AR-д бэлдэж байна…',                    en: 'Preparing AR…' },
  'ar.assetsMissing.title':   { mn: 'AR хараахан нээгдээгүй байна',          en: 'AR is not available yet' },
  'ar.assetsMissing.body':    { mn: 'Энэ дүрд AR файл удахгүй нэмэгдэнэ.',    en: 'AR for this figure is coming soon.' },
  'ar.back':                  { mn: 'Буцах',                                 en: 'Back' },
  'ar.mute':                  { mn: 'Дуу хаах',                              en: 'Mute' },
  'ar.unmute':                { mn: 'Дуу нээх',                              en: 'Unmute' },
  'ar.action.story':          { mn: 'Түүх',                                  en: 'Story' },
  'ar.action.quiz':           { mn: 'Шалгуур',                               en: 'Quiz' },
  'ar.action.askAi':          { mn: 'AI асуу',                               en: 'Ask AI' },
  'ar.hint.framing':          { mn: 'Картыг камерын дунд аваачиж, гэрэлтэй газар барина уу', en: 'Hold the card centered in the camera in good light' },
  'ar.error.permission':      { mn: 'Камер-р хандах эрх олгоно уу',          en: 'Please allow camera access' },
  'ar.error.permission.retry':{ mn: 'Дахин оролдох',                         en: 'Try again' },
  'ar.error.noCamera':        { mn: 'Энэ төхөөрөмжид камер олдсонгүй',        en: 'No camera found on this device' },
  'ar.error.inAppBrowser':    { mn: 'Аппын дотор камер ашиглах боломжгүй. Safari/Chrome-оор нээнэ үү', en: 'Camera is not available inside in-app browsers. Open in Safari or Chrome.' },
  'ar.error.copyLink':        { mn: 'Холбоосыг хуулах',                      en: 'Copy link' },
  'ar.error.copied':          { mn: 'Хуулагдлаа',                            en: 'Copied' },
  'ar.error.slowConn':        { mn: 'Холболт удаан байна',                   en: 'Slow connection' },
  'ar.desktop.title':         { mn: 'Утсаараа сканнердана уу',                en: 'Scan with your phone' },
  'ar.desktop.subtitle':      { mn: 'Эсвэл дараах холбоосыг утсаараа нээнэ үү:', en: 'Or open this link on your phone:' },

  // AR feature — admin tab
  'admin.arTargets.tab':      { mn: 'AR',                                    en: 'AR' },
  'admin.arTargets.upload':   { mn: '.mind хуулах',                          en: 'Upload .mind' },
  'admin.arTargets.replace':  { mn: 'Солих',                                 en: 'Replace' },
  'admin.arTargets.delete':   { mn: 'Устгах',                                en: 'Delete' },
  'admin.arTargets.help':     { mn: 'Энэ файлыг MindAR Target Compiler (https://hiukim.github.io/mind-ar-js-doc/tools/compile)-аар хөрвүүлж авна уу. Картын урд талын зургийг оруулж, .mind файл татаж авч энд хуулна уу.',
                                en: 'Compile this file with the MindAR Target Compiler (https://hiukim.github.io/mind-ar-js-doc/tools/compile). Upload the card front image, download the .mind file, and upload it here.' },
  'admin.arTargets.empty':    { mn: 'AR файл байхгүй',                       en: 'No AR target' },
  'admin.arTargets.noVideoFirst': { mn: 'Видео хуулсны дараа боломжтой',     en: 'Upload video first' },
  'admin.arTargets.replaceWarn':  { mn: 'Хуучин AR файл устах болно. Үргэлжлүүлэх үү?', en: 'The previous AR target will be deleted. Continue?' },
  'admin.arTargets.tooBig':   { mn: '.mind файл хэт том ({mb} MB > 5 MB)',    en: 'File too large ({mb} MB > 5 MB)' },
  'admin.arTargets.notMind':  { mn: '.mind өргөтгөлтэй файл байх ёстой',     en: 'File must have a .mind extension' },
```

- [ ] **Step 2: Verify the existing i18n test still passes**

```bash
npm test -- --run src/lib/i18n.test.jsx
```
Expected: PASS — interpolation already supports `{mb}` style placeholders.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.jsx
git commit -m "feat(ar): i18n strings for AR view + admin uploader"
```

---

## Task 4: `useFigureARTarget` hook — failing test

**Files:**
- Create: `src/hooks/useFigureARTarget.test.js`

- [ ] **Step 1: Write the test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...a) => mockFrom(...a) },
}));

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');

import { useFigureARTarget } from '@/hooks/useFigureARTarget';

function row(video_path, ar_target_path) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: video_path == null && ar_target_path == null
              ? null
              : { fig_id: 1, video_path, ar_target_path },
            error: null,
          }),
      }),
    }),
  };
}

function wrap({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => mockFrom.mockReset());

describe('useFigureARTarget', () => {
  it('returns ready=true with videoUrl + targetUrl when both paths present', async () => {
    mockFrom.mockReturnValue(row('1/back-1.mp4', '1/target-1.mind'));
    const { result } = renderHook(() => useFigureARTarget(1), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    expect(result.current.videoUrl).toBe(
      'https://example.supabase.co/storage/v1/object/public/figure-videos/1/back-1.mp4'
    );
    expect(result.current.targetUrl).toBe(
      'https://example.supabase.co/storage/v1/object/public/figure-videos/1/target-1.mind'
    );
  });

  it('returns ready=false when video_path missing', async () => {
    mockFrom.mockReturnValue(row(null, '1/target-1.mind'));
    const { result } = renderHook(() => useFigureARTarget(1), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    expect(result.current.videoUrl).toBeNull();
  });

  it('returns ready=false when ar_target_path missing', async () => {
    mockFrom.mockReturnValue(row('1/back-1.mp4', null));
    const { result } = renderHook(() => useFigureARTarget(1), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    expect(result.current.targetUrl).toBeNull();
  });

  it('returns ready=false when row absent entirely', async () => {
    mockFrom.mockReturnValue(row(null, null));
    const { result } = renderHook(() => useFigureARTarget(1), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
  });
});
```

- [ ] **Step 2: Run — must fail with module-not-found**

```bash
npm test -- --run src/hooks/useFigureARTarget.test.js
```
Expected: FAIL — `Cannot find module '@/hooks/useFigureARTarget'`.

---

## Task 5: `useFigureARTarget` hook — implement

**Files:**
- Create: `src/hooks/useFigureARTarget.js`

- [ ] **Step 1: Write the hook**

```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'figure-videos';

function publicUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export function useFigureARTarget(figId) {
  const id = Number(figId);
  const enabled = Number.isInteger(id) && id > 0;

  const query = useQuery({
    queryKey: ['figure_ar_target', id],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('figure_back_videos')
        .select('fig_id, video_path, ar_target_path')
        .eq('fig_id', id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const row = query.data;
  const videoUrl = publicUrl(row?.video_path);
  const targetUrl = publicUrl(row?.ar_target_path);
  const ready = !!(videoUrl && targetUrl);

  return {
    ready,
    videoUrl,
    targetUrl,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
```

- [ ] **Step 2: Run the test — must pass**

```bash
npm test -- --run src/hooks/useFigureARTarget.test.js
```
Expected: PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFigureARTarget.js src/hooks/useFigureARTarget.test.js
git commit -m "feat(ar): useFigureARTarget hook + tests"
```

---

## Task 6: `ARLaunchButton` — failing test

**Files:**
- Create: `src/components/ARLaunchButton.test.jsx`

- [ ] **Step 1: Write the test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '@/lib/i18n';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockHook = vi.fn();
vi.mock('@/hooks/useFigureARTarget', () => ({
  useFigureARTarget: (...a) => mockHook(...a),
}));

import ARLaunchButton from '@/components/ARLaunchButton';

function ui(props) {
  return (
    <MemoryRouter>
      <LangProvider>
        <ARLaunchButton {...props} />
      </LangProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockNavigate.mockReset();
  mockHook.mockReset();
});

describe('ARLaunchButton', () => {
  it('renders loading state', () => {
    mockHook.mockReturnValue({ ready: false, loading: true });
    render(ui({ figId: 7, variant: 'full' }));
    expect(screen.getByTestId('ar-launch-loading')).toBeInTheDocument();
  });

  it('navigates to /ar/:figId when ready and clicked (full)', () => {
    mockHook.mockReturnValue({ ready: true, loading: false });
    render(ui({ figId: 7, variant: 'full' }));
    fireEvent.click(screen.getByRole('button', { name: /AR харах|View in AR/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/ar/7');
  });

  it('shows coming-soon disabled state when not ready', () => {
    mockHook.mockReturnValue({ ready: false, loading: false });
    render(ui({ figId: 7, variant: 'full' }));
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/Тун удахгүй|Coming soon/i);
    fireEvent.click(btn);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('compact variant renders an icon-only button with accessible label', () => {
    mockHook.mockReturnValue({ ready: true, loading: false });
    render(ui({ figId: 7, variant: 'compact' }));
    const btn = screen.getByRole('button', { name: /AR харах|View in AR/i });
    expect(btn).toHaveAttribute('data-variant', 'compact');
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/ar/7');
  });
});
```

- [ ] **Step 2: Run — must fail**

```bash
npm test -- --run src/components/ARLaunchButton.test.jsx
```
Expected: FAIL — module not found.

---

## Task 7: `ARLaunchButton` — implement

**Files:**
- Create: `src/components/ARLaunchButton.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLang } from '@/lib/i18n';
import { useFigureARTarget } from '@/hooks/useFigureARTarget';

function ARGlyph({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M3 7v-3h3M21 7v-3h-3M3 17v3h3M21 17v3h-3" />
      <path d="M12 6 4 10l8 4 8-4-8-4z" />
      <path d="M4 10v6l8 4M20 10v6l-8 4M12 14v6" />
    </svg>
  );
}

export default function ARLaunchButton({ figId, variant = 'full' }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const { ready, loading } = useFigureARTarget(figId);

  if (loading) {
    return (
      <span
        data-testid="ar-launch-loading"
        className={
          variant === 'compact'
            ? 'inline-block w-8 h-8 rounded-full border border-gold/40 animate-pulse'
            : 'inline-flex items-center gap-2 px-4 py-2 border border-gold/40 rounded animate-pulse text-gold/60 text-xs font-meta tracking-[0.2em] uppercase'
        }
      >
        {variant === 'compact' ? '' : t('ar.loading')}
      </span>
    );
  }

  const onClick = () => {
    if (!ready) return;
    navigate(`/ar/${figId}`);
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!ready}
        data-variant="compact"
        aria-label={t('ar.button.full')}
        title={ready ? t('ar.button.full') : t('ar.button.tooltipDisabled')}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center
          ${ready
            ? 'bg-ink/70 text-gold border border-gold/70 hover:scale-110 transition-transform'
            : 'bg-ink/40 text-bronze/50 border border-bronze/30 cursor-not-allowed'}`}
        style={{ minWidth: 44, minHeight: 44, padding: 0 }}
      >
        {ready && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border border-gold/70 motion-safe:animate-[arPulse_2.4s_ease-out_infinite]"
          />
        )}
        <ARGlyph size={14} />
      </button>
    );
  }

  // full variant — distinct from crimson/brass action buttons
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready}
      data-variant="full"
      className={`relative inline-flex items-center gap-2 px-4 py-2 font-meta text-[10px] tracking-[0.28em] uppercase
        ${ready
          ? 'text-gold hover:text-ivory transition-colors'
          : 'text-bronze/60 cursor-not-allowed'}`}
    >
      <span
        aria-hidden
        className={`absolute inset-0 border ${ready ? 'border-gold/70' : 'border-bronze/40'}`}
        style={{ background: ready
          ? 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(184,134,11,0.04))'
          : 'transparent' }}
      />
      {ready && (
        <motion.span
          aria-hidden
          className="absolute inset-0 border border-gold/40 motion-safe:animate-[arPulse_2.4s_ease-out_infinite]"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">
        <ARGlyph size={14} />
        {ready ? t('ar.button.full') : t('ar.button.comingSoon')}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Add the keyframe to global CSS**

Modify `src/index.css` — append at the bottom:

```css
@keyframes arPulse {
  0%   { transform: scale(1);   opacity: 0.9; }
  70%  { transform: scale(1.4); opacity: 0;   }
  100% { transform: scale(1.4); opacity: 0;   }
}
```

- [ ] **Step 3: Run the test — must pass**

```bash
npm test -- --run src/components/ARLaunchButton.test.jsx
```
Expected: PASS — 4 tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/ARLaunchButton.jsx src/components/ARLaunchButton.test.jsx src/index.css
git commit -m "feat(ar): ARLaunchButton (full + compact) with gold pulse"
```

---

## Task 8: `DesktopFallback` — failing test

**Files:**
- Create: `src/components/ar/DesktopFallback.test.jsx`

- [ ] **Step 1: Write the test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LangProvider } from '@/lib/i18n';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') },
}));

import DesktopFallback from '@/components/ar/DesktopFallback';

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://altan-domog.example' },
    writable: true,
  });
  navigator.clipboard = { writeText: vi.fn().mockResolvedValue() };
});

describe('DesktopFallback', () => {
  it('renders QR encoding /ar/:figId on this origin', async () => {
    render(
      <LangProvider>
        <DesktopFallback figId={7} figureName="Чингис Хаан" />
      </LangProvider>,
    );
    const qrcode = await import('qrcode');
    await waitFor(() =>
      expect(qrcode.default.toDataURL).toHaveBeenCalledWith(
        'https://altan-domog.example/ar/7',
        expect.any(Object),
      ),
    );
    expect(screen.getByText('https://altan-domog.example/ar/7')).toBeInTheDocument();
  });

  it('copies link to clipboard on click', async () => {
    render(
      <LangProvider>
        <DesktopFallback figId={7} figureName="Чингис Хаан" />
      </LangProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Хуулах|Copy/i }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://altan-domog.example/ar/7',
      ),
    );
  });
});
```

- [ ] **Step 2: Run — must fail**

```bash
npm test -- --run src/components/ar/DesktopFallback.test.jsx
```
Expected: FAIL — module not found.

---

## Task 9: `DesktopFallback` — implement

**Files:**
- Create: `src/components/ar/DesktopFallback.jsx`

- [ ] **Step 1: Verify `qrcode` is in dependencies**

Read `package.json` → `dependencies`. If `qrcode` is missing, install it:

```bash
npm install qrcode@^1.5.3
```

(If already present, skip the install.)

- [ ] **Step 2: Write the component**

```jsx
import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { useLang } from '@/lib/i18n';

export default function DesktopFallback({ figId, figureName }) {
  const { t } = useLang();
  const [qrSrc, setQrSrc] = useState(null);
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/ar/${figId}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 240, margin: 1 }).then((src) => {
      if (!cancelled) setQrSrc(src);
    });
    return () => { cancelled = true; };
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — leave UI as-is */
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6 border border-brass/40 bg-card/40 backdrop-blur-md p-8 rounded">
        <h1 className="font-cinzel text-xl text-ivory">{figureName}</h1>
        <h2 className="font-meta text-[11px] tracking-[0.3em] uppercase text-gold">
          {t('ar.desktop.title')}
        </h2>
        <div className="flex justify-center">
          {qrSrc ? (
            <img src={qrSrc} alt="QR code" className="w-60 h-60 rounded bg-white p-2" />
          ) : (
            <div className="w-60 h-60 bg-card animate-pulse rounded" />
          )}
        </div>
        <p className="text-xs text-ivory/70 font-body">{t('ar.desktop.subtitle')}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs font-mono text-ivory/85 bg-ink/60 px-2 py-1.5 rounded border border-brass/30">
            {url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={t('ar.error.copyLink')}
            className="px-2 py-1.5 border border-brass/50 rounded hover:bg-brass/10 text-gold"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the test — must pass**

```bash
npm test -- --run src/components/ar/DesktopFallback.test.jsx
```
Expected: PASS — 2 tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/ar/DesktopFallback.jsx src/components/ar/DesktopFallback.test.jsx package.json package-lock.json
git commit -m "feat(ar): DesktopFallback QR-code panel for desktop visitors"
```

---

## Task 10: Install AR dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install A-Frame and MindAR**

```bash
npm install aframe@^1.5.0 mind-ar@^1.2.5
```

- [ ] **Step 2: Verify Vite can resolve them at build time** — A-Frame has historically had issues with strict ESM. Run a quick build:

```bash
npm run build
```
Expected: build completes without errors. (If it fails on A-Frame, the typical fix is adding `optimizeDeps.include: ['aframe']` to `vite.config.js`.)

- [ ] **Step 3: Run full test suite (these libs are dynamic-imported, should not affect tests yet)**

```bash
npm test -- --run
```
Expected: all green (no new tests yet beyond Tasks 4–9).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(ar): add aframe + mind-ar dependencies"
```

---

## Task 11: `MindARScene` — implement (no jsdom test)

**Files:**
- Create: `src/components/ar/MindARScene.jsx`

`MindARScene` is the bridge between React and A-Frame. A-Frame registers HTML custom elements (`<a-scene>`, `<a-camera>`, etc.) at module load; React doesn't reconcile them well, so we build the scene tree imperatively with `document.createElement`. This also avoids any HTML-string interpolation of URLs.

The scene is mounted to a container `<div>` in a `useEffect`; on unmount we remove it from the DOM and stop any active camera tracks (MindAR holds a `MediaStream` that can leak across navigations otherwise).

- [ ] **Step 1: Write the component**

```jsx
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '@/lib/i18n';

const FRAMING_HINT_MS = 15000;
const SLOW_VIDEO_MS   = 8000;

export default function MindARScene({
  figId,
  figureName,
  videoUrl,
  targetUrl,
  storyChapter,
  onError,
}) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useLang();
  const [muted, setMuted] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSlow, setShowSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let scene = null;
    let stopCameraTracks = () => {};
    let hintTimer, slowTimer;

    Promise.all([
      import('aframe'),
      import('mind-ar/dist/mindar-image-aframe.prod.js'),
    ]).then(() => {
      if (cancelled || !containerRef.current) return;
      scene = buildScene(targetUrl, videoUrl);
      containerRef.current.appendChild(scene);

      const video = scene.querySelector('#figVideo');
      const onTargetFound = () => {
        setTracking(true);
        setShowHint(false);
        clearTimeout(hintTimer);
        video?.play().catch(() => {});
      };
      const onTargetLost = () => {
        setTracking(false);
        video?.pause();
      };
      const onArError = (event) => {
        onError?.(event?.detail || event);
      };

      scene.addEventListener('targetFound', onTargetFound);
      scene.addEventListener('targetLost', onTargetLost);
      scene.addEventListener('arError', onArError);

      hintTimer = setTimeout(() => setShowHint(true), FRAMING_HINT_MS);
      slowTimer = setTimeout(() => {
        if (video?.readyState < 2) setShowSlow(true);
      }, SLOW_VIDEO_MS);

      // Camera-track cleanup: A-Frame stores the stream on the scene's
      // internal renderer; we grab it from the active video tracks on tear-down.
      stopCameraTracks = () => {
        const allVideos = scene.querySelectorAll('video');
        allVideos.forEach((v) => {
          const ms = v.srcObject;
          if (ms && typeof ms.getTracks === 'function') {
            ms.getTracks().forEach((t) => t.stop());
          }
        });
      };
    }).catch((err) => {
      if (!cancelled) onError?.(err);
    });

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      clearTimeout(slowTimer);
      try { stopCameraTracks(); } catch { /* best-effort */ }
      if (scene && scene.parentNode) scene.parentNode.removeChild(scene);
    };
  }, [targetUrl, videoUrl, onError]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      const v = containerRef.current?.querySelector('#figVideo');
      if (v) v.muted = next;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black z-[300]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-ivory flex items-center gap-1.5 text-sm font-meta tracking-[0.22em] uppercase"
          aria-label={t('ar.back')}
        >
          <ArrowLeft className="w-4 h-4" /> {t('ar.back')}
        </button>
        <div className="text-ivory font-cinzel text-sm truncate px-3">{figureName}</div>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? t('ar.unmute') : t('ar.mute')}
          className="text-ivory"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Hint banner */}
      {showHint && !tracking && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-ink/85 border border-gold/50 rounded text-xs text-gold font-body z-10 max-w-[88vw] text-center">
          {t('ar.hint.framing')}
        </div>
      )}
      {showSlow && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 px-4 py-2 bg-ink/85 border border-bronze/50 rounded text-xs text-bronze font-body z-10">
          {t('ar.error.slowConn')}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-around px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
        {storyChapter && (
          <button
            type="button"
            onClick={() => navigate(`/story/${storyChapter}`)}
            className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.24em] uppercase"
          >
            {t('ar.action.story')}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/figure/${figId}#quiz`)}
          className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.24em] uppercase"
        >
          {t('ar.action.quiz')}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/c/${figId}`)}
          className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.24em] uppercase"
        >
          {t('ar.action.askAi')}
        </button>
      </div>
    </div>
  );
}

function buildScene(targetUrl, videoUrl) {
  const scene = document.createElement('a-scene');
  const safeTarget = encodeURI(targetUrl);
  scene.setAttribute('mindar-image', `imageTargetSrc: ${safeTarget}; autoStart: true; uiLoading: no; uiError: no; uiScanning: no;`);
  scene.setAttribute('color-space', 'sRGB');
  scene.setAttribute('renderer', 'colorManagement: true; physicallyCorrectLights');
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  scene.style.position = 'absolute';
  scene.style.inset = '0';

  const assets = document.createElement('a-assets');
  const video = document.createElement('video');
  video.id = 'figVideo';
  video.src = videoUrl;
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = true;
  video.crossOrigin = 'anonymous';
  video.setAttribute('webkit-playsinline', '');
  assets.appendChild(video);
  scene.appendChild(assets);

  const camera = document.createElement('a-camera');
  camera.setAttribute('position', '0 0 0');
  camera.setAttribute('look-controls', 'enabled: false');
  scene.appendChild(camera);

  const target = document.createElement('a-entity');
  target.setAttribute('mindar-image-target', 'targetIndex: 0');
  const plane = document.createElement('a-video');
  plane.setAttribute('src', '#figVideo');
  plane.setAttribute('position', '0 0 0');
  plane.setAttribute('width', '1');
  plane.setAttribute('height', '0.552');
  plane.setAttribute('rotation', '0 0 0');
  target.appendChild(plane);
  scene.appendChild(target);

  return scene;
}
```

- [ ] **Step 2: Type-check via build**

```bash
npm run build
```
Expected: PASS. (If A-Frame's import causes Vite to choke, add `optimizeDeps: { include: ['aframe'] }` to `vite.config.js` and try again.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ar/MindARScene.jsx
git commit -m "feat(ar): MindARScene component with imperative A-Frame mount"
```

---

## Task 12: `ARView` page — failing test

**Files:**
- Create: `src/pages/ARView.test.jsx`

The test stubs out `MindARScene` (since A-Frame can't run in jsdom) and `useIsMobile` so we can exercise the desktop / mobile-ready / mobile-missing branches.

- [ ] **Step 1: Write the test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LangProvider } from '@/lib/i18n';

const mockHook = vi.fn();
const mockMobile = vi.fn();
vi.mock('@/hooks/useFigureARTarget', () => ({
  useFigureARTarget: (...a) => mockHook(...a),
}));
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: (...a) => mockMobile(...a),
}));
vi.mock('@/components/ar/MindARScene', () => ({
  default: (props) => (
    <div data-testid="mindar-scene-stub" data-fig={props.figId} />
  ),
}));
vi.mock('@/components/ar/DesktopFallback', () => ({
  default: ({ figId }) => <div data-testid="desktop-fallback-stub" data-fig={figId} />,
}));

import ARView from '@/pages/ARView';

function ui(figId) {
  return (
    <LangProvider>
      <MemoryRouter initialEntries={[`/ar/${figId}`]}>
        <Routes>
          <Route path="/ar/:figId" element={<ARView />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  );
}

beforeEach(() => {
  mockHook.mockReset();
  mockMobile.mockReset();
});

describe('ARView', () => {
  it('shows DesktopFallback on desktop', () => {
    mockMobile.mockReturnValue(false);
    mockHook.mockReturnValue({ ready: true, loading: false, videoUrl: 'v', targetUrl: 't' });
    render(ui(7));
    expect(screen.getByTestId('desktop-fallback-stub')).toHaveAttribute('data-fig', '7');
  });

  it('shows MindARScene on mobile when assets ready', () => {
    mockMobile.mockReturnValue(true);
    mockHook.mockReturnValue({ ready: true, loading: false, videoUrl: 'v', targetUrl: 't' });
    render(ui(7));
    expect(screen.getByTestId('mindar-scene-stub')).toHaveAttribute('data-fig', '7');
  });

  it('shows assets-missing panel on mobile when not ready', () => {
    mockMobile.mockReturnValue(true);
    mockHook.mockReturnValue({ ready: false, loading: false, videoUrl: null, targetUrl: null });
    render(ui(7));
    expect(screen.getByText(/AR хараахан нээгдээгүй|AR is not available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('mindar-scene-stub')).toBeNull();
  });

  it('shows loading spinner while loading', () => {
    mockMobile.mockReturnValue(true);
    mockHook.mockReturnValue({ ready: false, loading: true });
    render(ui(7));
    expect(screen.getByTestId('ar-view-loading')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — must fail**

```bash
npm test -- --run src/pages/ARView.test.jsx
```
Expected: FAIL — module not found.

---

## Task 13: `ARView` page — implement

**Files:**
- Create: `src/pages/ARView.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFigureARTarget } from '@/hooks/useFigureARTarget';
import { FIGURES } from '@/lib/figuresData';
import MindARScene from '@/components/ar/MindARScene';
import DesktopFallback from '@/components/ar/DesktopFallback';

const FIGURE_TO_CHAPTER = {
  // Map fig_id -> story chapter slug. Empty by default; populated as story
  // content lands. When no entry exists, the Story button is hidden.
};

function ErrorPanel({ titleKey, bodyKey, onBack, onRetry, retryLabelKey }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 bg-ink z-[300] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-5 border border-brass/40 p-6 rounded">
        <h2 className="font-cinzel text-lg text-ivory">{t(titleKey)}</h2>
        {bodyKey && <p className="text-sm text-ivory/75 font-body">{t(bodyKey)}</p>}
        <div className="flex justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 border border-gold/60 text-gold text-xs font-meta tracking-[0.22em] uppercase"
            >
              {t(retryLabelKey || 'ar.error.permission.retry')}
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.22em] uppercase"
          >
            {t('ar.back')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ARView() {
  const { figId } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const isMobile = useIsMobile();
  const { ready, loading, videoUrl, targetUrl } = useFigureARTarget(figId);
  const [arError, setArError] = useState(null);

  const id = Number(figId);
  const figure = FIGURES.find((f) => f.fig_id === id);
  const figureName = figure?.name ?? '';

  if (loading) {
    return (
      <div
        data-testid="ar-view-loading"
        className="fixed inset-0 bg-ink flex items-center justify-center"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-gold/40 mx-auto" />
          <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-crimson rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ivory/70 font-body">{t('ar.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isMobile) {
    return <DesktopFallback figId={id} figureName={figureName} />;
  }

  if (!ready) {
    return (
      <ErrorPanel
        titleKey="ar.assetsMissing.title"
        bodyKey="ar.assetsMissing.body"
        onBack={() => navigate(-1)}
      />
    );
  }

  if (arError === 'permission') {
    return (
      <ErrorPanel
        titleKey="ar.error.permission"
        onBack={() => navigate(-1)}
        onRetry={() => setArError(null)}
        retryLabelKey="ar.error.permission.retry"
      />
    );
  }
  if (arError === 'no_camera') {
    return <ErrorPanel titleKey="ar.error.noCamera" onBack={() => navigate(-1)} />;
  }
  if (arError === 'in_app_browser') {
    return <ErrorPanel titleKey="ar.error.inAppBrowser" onBack={() => navigate(-1)} />;
  }

  const handleArError = (err) => {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      setArError('in_app_browser');
    } else if (msg.includes('notfound')) {
      setArError('no_camera');
    } else {
      setArError('permission');
    }
  };

  return (
    <MindARScene
      figId={id}
      figureName={figureName}
      videoUrl={videoUrl}
      targetUrl={targetUrl}
      storyChapter={FIGURE_TO_CHAPTER[id]}
      onError={handleArError}
    />
  );
}
```

- [ ] **Step 2: Run the test — must pass**

```bash
npm test -- --run src/pages/ARView.test.jsx
```
Expected: PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ARView.jsx src/pages/ARView.test.jsx
git commit -m "feat(ar): ARView page (loading/desktop/mobile-ready/mobile-missing)"
```

---

## Task 14: Wire the `/ar/:figId` route into the app

**Files:**
- Modify: `src/App.jsx`

The AR bundle pulls in A-Frame (~250 KB). Use `React.lazy` so it doesn't bloat the main bundle.

- [ ] **Step 1: Add the lazy import + route**

Replace the static `import` for ARView with a lazy import — but since we did not export ARView yet from any other place, simply add the lazy load + Suspense:

At the top of the file (after the other static imports):

```jsx
import { lazy, Suspense } from 'react';
const ARView = lazy(() => import('@/pages/ARView'));
```

Inside `<Routes>` (before `<Route path="*" ...>`), add:

```jsx
<Route
  path="/ar/:figId"
  element={
    <OtpGate>
      <Suspense fallback={
        <div className="fixed inset-0 bg-ink flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-crimson rounded-full animate-spin" />
        </div>
      }>
        <ARView />
      </Suspense>
    </OtpGate>
  }
/>
```

- [ ] **Step 2: Verify build still succeeds (route is reachable, lazy chunk emitted)**

```bash
npm run build
```
Expected: PASS, with a separate chunk for ARView in the build output.

- [ ] **Step 3: Run test suite**

```bash
npm test -- --run
```
Expected: still green.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(ar): mount lazy /ar/:figId route under OtpGate"
```

---

## Task 15: Wire `<ARLaunchButton variant="full">` into `FigureDetail`

**Files:**
- Modify: `src/pages/FigureDetail.jsx`

The button goes in the top action row alongside the Share + Team-toggle buttons (around lines 150–181 of `FigureDetail.jsx`). The full variant matches the other action buttons in scale.

- [ ] **Step 1: Add the import**

Near the top of `FigureDetail.jsx`, add:

```jsx
import ARLaunchButton from '@/components/ARLaunchButton';
```

- [ ] **Step 2: Render it in the top action row**

Find the block:

```jsx
          <div className="flex items-center gap-2">
            {/* Share */}
            <button ...
```

Insert `<ARLaunchButton figId={Number(figId)} variant="full" />` as the first child of `<div className="flex items-center gap-2">`. Result:

```jsx
          <div className="flex items-center gap-2">
            <ARLaunchButton figId={Number(figId)} variant="full" />
            {/* Share */}
            <button ...
```

- [ ] **Step 3: Run the FigureDetail tests** — there are none currently for FigureDetail itself; run the full suite to confirm no regressions:

```bash
npm test -- --run
```
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/pages/FigureDetail.jsx
git commit -m "feat(ar): wire ARLaunchButton into FigureDetail action row"
```

---

## Task 16: Wire compact `<ARLaunchButton>` into `Card3D`

**Files:**
- Modify: `src/components/Card3D.jsx`
- Modify: `src/components/Card3D.test.jsx` (only if existing tests break)

Goal: overlay a compact AR button on the top-right of the 3D card container. The card itself is rendered in a Three.js canvas; the button sits as a sibling absolute-positioned element on top.

- [ ] **Step 1: Read `src/components/Card3D.jsx` end-to-end** to find the outer-container JSX (the `return (...)` block). The component returns its canvas inside a wrapper `<div>` — that's the anchor for the compact button.

- [ ] **Step 2: Add the import + overlay**

At the top of `Card3D.jsx`:

```jsx
import ARLaunchButton from '@/components/ARLaunchButton';
```

In the return JSX, wrap the existing root element (or augment it) so it has `position: relative` and add the button as an absolutely-positioned overlay:

```jsx
return (
  <div className="relative">
    {/* existing canvas / contents */}
    {/* ... */}
    <div className="absolute top-2 right-2 z-10">
      <ARLaunchButton figId={figure.fig_id} variant="compact" />
    </div>
  </div>
);
```

(If the existing root already has `position: relative`, just add the overlay wrapper inside it.)

- [ ] **Step 3: Run the Card3D test**

```bash
npm test -- --run src/components/Card3D.test.jsx
```
Expected: PASS. If the test renders Card3D without a `QueryClientProvider` and now fails because `ARLaunchButton` reaches into TanStack Query, wrap the test setup in a `QueryClientProvider` in the existing test file.

- [ ] **Step 4: Run the full suite**

```bash
npm test -- --run
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/Card3D.jsx src/components/Card3D.test.jsx
git commit -m "feat(ar): overlay compact ARLaunchButton on Card3D"
```

---

## Task 17: Edge function `upload-figure-ar-target` — implement

**Files:**
- Create: `supabase/functions/upload-figure-ar-target/index.ts`

Mirrors the existing `upload-figure-back-video` exactly: same JWT-auth + admin-check pattern, same `figure-videos` bucket, same atomic-replace via timestamped filenames.

- [ ] **Step 1: Write the function**

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

const MAX_TARGET_BYTES = 5 * 1024 * 1024;  // 5 MB
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

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.startsWith('multipart/form-data')) {
    const form = await req.formData();
    const action = String(form.get('action') ?? '');
    const figIdRaw = form.get('fig_id');
    const figId = Number(figIdRaw);
    if (!Number.isInteger(figId) || figId <= 0) return json({ ok: false, reason: 'bad_request' }, 400);

    if (action === 'upload-target') {
      const file = form.get('file');
      if (!(file instanceof File)) return json({ ok: false, reason: 'bad_request' }, 400);
      if (file.size > MAX_TARGET_BYTES) return json({ ok: false, reason: 'too_large' }, 400);
      if (!file.name.toLowerCase().endsWith('.mind')) {
        return json({ ok: false, reason: 'bad_extension' }, 400);
      }

      // A figure is AR-ready iff video_path exists. Refuse upload otherwise.
      const { data: existing } = await admin
        .from('figure_back_videos')
        .select('video_path, ar_target_path')
        .eq('fig_id', figId)
        .maybeSingle();
      if (!existing?.video_path) {
        return json({ ok: false, reason: 'no_video' }, 400);
      }

      const newPath = `${figId}/target-${Date.now()}.mind`;
      const buf = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from(BUCKET).upload(newPath, buf, {
        contentType: 'application/octet-stream',
        cacheControl: '2592000',
        upsert: false,
      });
      if (upErr) return json({ ok: false, reason: 'upload_failed', detail: upErr.message }, 500);

      const { error: rowErr } = await admin
        .from('figure_back_videos')
        .update({
          ar_target_path: newPath,
          uploaded_by: adminUserId,
          uploaded_at: new Date().toISOString(),
        })
        .eq('fig_id', figId);
      if (rowErr) {
        await admin.storage.from(BUCKET).remove([newPath]);
        return json({ ok: false, reason: 'server', detail: rowErr.message }, 500);
      }

      if (existing.ar_target_path && existing.ar_target_path !== newPath) {
        await admin.storage.from(BUCKET).remove([existing.ar_target_path]);
      }

      const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${newPath}`;
      return json({ ok: true, ar_target_path: newPath, public_url: publicUrl });
    }

    return json({ ok: false, reason: 'bad_action' }, 400);
  }

  // JSON body — only for delete-target.
  const body: { action?: string; fig_id?: number } = await req.json().catch(() => ({}));
  if (body.action !== 'delete-target') return json({ ok: false, reason: 'bad_request' }, 400);
  const figId = Number(body.fig_id);
  if (!Number.isInteger(figId) || figId <= 0) return json({ ok: false, reason: 'bad_request' }, 400);

  const { data: existing } = await admin
    .from('figure_back_videos')
    .select('ar_target_path')
    .eq('fig_id', figId)
    .maybeSingle();
  if (existing?.ar_target_path) {
    await admin.storage.from(BUCKET).remove([existing.ar_target_path]);
    await admin
      .from('figure_back_videos')
      .update({ ar_target_path: null })
      .eq('fig_id', figId);
  }
  return json({ ok: true });
});
```

- [ ] **Step 2: Deploy via Supabase MCP**

Use `mcp__supabase__deploy_edge_function` with `name: 'upload-figure-ar-target'` and the file body above. (The deploy call will also create the function if it doesn't exist.)

- [ ] **Step 3: Verify the function listing includes the new fn**

Use `mcp__supabase__list_edge_functions` and confirm `upload-figure-ar-target` is present.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/upload-figure-ar-target/index.ts
git commit -m "feat(ar): upload-figure-ar-target edge function"
```

---

## Task 18: `ARTargetUploader` admin component — failing test

**Files:**
- Create: `src/components/admin/ARTargetUploader.test.jsx`

- [ ] **Step 1: Write the test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LangProvider } from '@/lib/i18n';

const mockInvoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a) => mockInvoke(...a) } },
}));

import ARTargetUploader from '@/components/admin/ARTargetUploader';

const figures = [
  { fig_id: 1, ico: '👑', name: 'Чингис Хаан' },
  { fig_id: 2, ico: '👑', name: 'Хубилай Хаан' },
];

beforeEach(() => mockInvoke.mockReset());

describe('ARTargetUploader', () => {
  it('renders a row per figure with status', () => {
    render(
      <LangProvider>
        <ARTargetUploader
          figures={figures}
          videosById={{
            1: { url: 'video1', arTargetPath: '1/target-1.mind' },
            2: { url: 'video2', arTargetPath: null },
          }}
          onChange={() => {}}
        />
      </LangProvider>,
    );
    expect(screen.getByText('Чингис Хаан')).toBeInTheDocument();
    expect(screen.getByText('Хубилай Хаан')).toBeInTheDocument();
    // fig 1 has target → shows "Solih/Replace"
    expect(screen.getByTestId('ar-action-1').textContent).toMatch(/Солих|Replace/i);
    // fig 2 has video but no target → shows "Upload .mind"
    expect(screen.getByTestId('ar-action-2').textContent).toMatch(/.mind/i);
  });

  it('disables upload when figure has no video uploaded yet', () => {
    render(
      <LangProvider>
        <ARTargetUploader
          figures={[{ fig_id: 3, ico: '👑', name: 'Бат Хаан' }]}
          videosById={{}}
          onChange={() => {}}
        />
      </LangProvider>,
    );
    expect(screen.getByTestId('ar-action-3')).toBeDisabled();
  });

  it('rejects non-.mind files client-side', async () => {
    const onChange = vi.fn();
    render(
      <LangProvider>
        <ARTargetUploader
          figures={[figures[1]]}
          videosById={{ 2: { url: 'video2', arTargetPath: null } }}
          onChange={onChange}
        />
      </LangProvider>,
    );
    const input = screen.getByTestId('ar-target-file-input-2');
    const bad = new File(['x'], 'foo.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(mockInvoke).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/.mind|extension/i);
    });
  });

  it('invokes upload-figure-ar-target with action + fig_id when .mind file picked', async () => {
    const onChange = vi.fn();
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    render(
      <LangProvider>
        <ARTargetUploader
          figures={[figures[1]]}
          videosById={{ 2: { url: 'video2', arTargetPath: null } }}
          onChange={onChange}
        />
      </LangProvider>,
    );
    const input = screen.getByTestId('ar-target-file-input-2');
    const file = new File([new Uint8Array([1, 2, 3])], 'card.mind', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'upload-figure-ar-target',
      expect.objectContaining({ body: expect.any(FormData) }),
    ));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run — must fail**

```bash
npm test -- --run src/components/admin/ARTargetUploader.test.jsx
```
Expected: FAIL — module not found.

---

## Task 19: `ARTargetUploader` — implement

**Files:**
- Create: `src/components/admin/ARTargetUploader.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useRef, useState } from 'react';
import { Upload, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const MAX_TARGET_BYTES = 5 * 1024 * 1024;

export default function ARTargetUploader({ figures, videosById = {}, onChange }) {
  const { t } = useLang();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const handleUpload = async (figId, file) => {
    setError('');
    if (!file.name.toLowerCase().endsWith('.mind')) {
      setError(t('admin.arTargets.notMind'));
      return;
    }
    if (file.size > MAX_TARGET_BYTES) {
      setError(t('admin.arTargets.tooBig', { mb: (file.size / 1024 / 1024).toFixed(1) }));
      return;
    }
    setBusy(figId);
    const form = new FormData();
    form.append('action', 'upload-target');
    form.append('fig_id', String(figId));
    form.append('file', file);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-ar-target', {
      body: form,
    });
    setBusy(null);
    if (invErr || !data?.ok) {
      setError(data?.reason || invErr?.message || 'server');
      return;
    }
    onChange?.();
  };

  const handleDelete = async (figId, hasTarget) => {
    if (!hasTarget) return;
    if (!window.confirm(t('admin.arTargets.replaceWarn'))) return;
    setBusy(figId);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-ar-target', {
      body: { action: 'delete-target', fig_id: figId },
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
      <p className="text-xs text-ivory/70 font-body">{t('admin.arTargets.help')}</p>
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
              <ARTargetRow
                key={f.fig_id}
                figure={f}
                video={v}
                busy={busy === f.fig_id}
                onUpload={(file) => handleUpload(f.fig_id, file)}
                onDelete={() => handleDelete(f.fig_id, !!v?.arTargetPath)}
                t={t}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function ARTargetRow({ figure, video, busy, onUpload, onDelete, t }) {
  const inputRef = useRef(null);
  const hasVideo = !!video?.url;
  const hasTarget = !!video?.arTargetPath;

  let statusText;
  if (!hasVideo) statusText = t('admin.arTargets.noVideoFirst');
  else if (hasTarget) statusText = '✓ .mind';
  else statusText = t('admin.arTargets.empty');

  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
      <span className="text-xl w-8 text-center">{figure.ico}</span>
      <div className="flex-1 min-w-0">
        <div className="font-cinzel text-sm font-bold truncate">{figure.name}</div>
        <div className="text-xs text-muted-foreground font-body">{statusText}</div>
      </div>
      <input
        type="file"
        accept=".mind"
        className="hidden"
        ref={inputRef}
        data-testid={`ar-target-file-input-${figure.fig_id}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !hasVideo}
        data-testid={`ar-action-${figure.fig_id}`}
        onClick={() => inputRef.current?.click()}
        className="gap-1"
      >
        {hasTarget ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
        {hasTarget ? t('admin.arTargets.replace') : t('admin.arTargets.upload')}
      </Button>
      {hasTarget && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onDelete}
          className="gap-1 text-red-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('admin.arTargets.delete')}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the test — must pass**

```bash
npm test -- --run src/components/admin/ARTargetUploader.test.jsx
```
Expected: PASS — 4 tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ARTargetUploader.jsx src/components/admin/ARTargetUploader.test.jsx
git commit -m "feat(ar): admin ARTargetUploader component + tests"
```

---

## Task 20: Wire `<ARTargetUploader>` into `AdminPanel`

**Files:**
- Modify: `src/components/admin/AdminPanel.jsx`

- [ ] **Step 1: Add the import**

Near the other admin imports:

```jsx
import ARTargetUploader from '@/components/admin/ARTargetUploader';
```

- [ ] **Step 2: Add the tab trigger**

In the `<TabsList>` block (around the `back-videos` trigger), add a sibling trigger after it:

```jsx
          <TabsTrigger value="ar-targets" className="gap-1.5 text-xs font-body">
            🎯 AR
          </TabsTrigger>
```

- [ ] **Step 3: Add the tab content**

After the existing `<TabsContent value="back-videos">` block:

```jsx
        <TabsContent value="ar-targets" className="flex-1 overflow-auto p-6">
          <ARTargetUploader
            figures={figures}
            videosById={videosById ?? {}}
            onChange={() => refetchVideos()}
          />
        </TabsContent>
```

- [ ] **Step 4: Run AdminPanel test**

```bash
npm test -- --run src/components/admin/AdminPanel.test.jsx
```
Expected: PASS — existing tests should ignore the new tab; if a test asserts on tab count, update it to expect the new "AR" tab.

- [ ] **Step 5: Run the full suite**

```bash
npm test -- --run
```
Expected: green, ~248 tests (223 baseline + ~14 from this plan: 4 useFigureARTarget + 4 ARLaunchButton + 2 DesktopFallback + 4 ARView + 4 ARTargetUploader = 18; rounded down because some assertions pair into single it()s).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminPanel.jsx src/components/admin/AdminPanel.test.jsx
git commit -m "feat(ar): wire ARTargetUploader into AdminPanel"
```

---

## Task 21: Final regression + linter sweep

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Expected: no errors. Fix any unused-import warnings introduced during the implementation.

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --run
```
Expected: all green; total ≈ 240–250.

- [ ] **Step 3: Run a production build**

```bash
npm run build
```
Expected: PASS. Confirm in the build output that an AR-related chunk (e.g., `ARView-*.js` or `mind-ar-*.js`) is emitted as a separate file — proves the lazy-load split worked.

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore(ar): lint fixups"
```

---

## Task 22: Manual phone-testing checklist (run before declaring shipped)

This is not optional — A-Frame + MindAR cannot be unit-tested. The implementer must run through and tick every box on a real device before calling the work done. Save the result of this run as a comment on the PR or as a brief log.

- [ ] iPhone (Safari): camera opens on `/ar/:figId`, target detected, video plays, audio works after unmute, back nav returns to previous page
- [ ] iPhone (Instagram or Facebook in-app browser): the in-app-browser fallback message appears (no camera prompt)
- [ ] Android (Chrome): same coverage as iPhone Safari
- [ ] Desktop (Chrome): `<DesktopFallback>` shows; QR scans correctly with phone and lands on the AR scene
- [ ] Real card under varying lighting — bright sun, dim indoor, screen reflection
- [ ] Hold card at 15 cm, 30 cm, 60 cm distances — note which range tracks
- [ ] Lose tracking by moving the card off-screen, then recover — video resumes from where it paused
- [ ] Camera permission denied at the OS prompt — error panel offers Try Again + Back

---

## Task 23: Wrap up

- [ ] **Step 1: Update memory** — Append a new entry to `MEMORY.md` and create `memory/ar_card_tracking_shipped.md` summarizing the feature, test count, and any phone-testing findings. Use the same shape as `card3d_video_back_shipped.md`.
- [ ] **Step 2: Open the merge request** — Per the `superpowers:finishing-a-development-branch` skill, push the branch and open a PR (or merge to `master` directly per project convention). Confirm Netlify/origin push afterwards (memory entry "live_mp_roster_gate_shipped" notes that pushing to `master` is not enough; push to `origin/main` too if Netlify is wired to it).
- [ ] **Step 3: Verify Supabase deploy** — `mcp__supabase__list_edge_functions` shows `upload-figure-ar-target`; `mcp__supabase__list_tables` for the public schema confirms `ar_target_path` exists on `figure_back_videos`.

---

## Self-review notes

**Spec coverage check:**
- Route `/ar/:figId` lazy-loaded under OtpGate → Tasks 13–14 ✔
- DB column added → Task 1 ✔
- Storage layout reuse → Task 17 ✔
- New files all enumerated → Tasks 4–19 cover every file in the spec's "New files" list ✔
- ARLaunchButton variants + states + pulse + disabled → Tasks 6–7 ✔
- DesktopFallback QR + copy → Tasks 8–9 ✔
- MindARScene imperative build, top-bar, bottom-bar, hint, slow-conn, error handling → Tasks 11 + 13 ✔
- ARTargetUploader admin table, statuses, validation, replace flow, edge function call → Tasks 18–20 ✔
- Edge cases (camera denied, no camera, in-app browser, slow video, asset 404) → Tasks 11 + 13 (in-app browser + permission + no_camera all routed through `handleArError`) ✔
- Tests: 5 new test files matching the spec's test list → Tasks 4, 6, 8, 12, 18 ✔
- Manual phone-testing checklist → Task 22 ✔
- Dependencies aframe + mind-ar → Task 10 ✔; `qrcode` add-only-if-missing → Task 9 step 1 ✔

**Type / name consistency:**
- `useFigureARTarget` returns `{ ready, videoUrl, targetUrl, loading, error }` everywhere it's used (defined in Task 5, consumed in Tasks 7 + 13).
- Edge function action names: `upload-target`, `delete-target` — matched between Task 17 (server) and Task 19 (client).
- `videosById[figId].arTargetPath` used in `ARTargetUploader` — matches the field added in Task 2 to `useFigureBackVideos`.
- `arTargetUrl` on `videosById` is exposed but `ARTargetUploader` only needs the path (presence indicator), so it reads `arTargetPath` — both are present.

**No-placeholder scan:** no TBDs, no "implement later", no "similar to Task N", no unsourced types.

# Story — Phase C: Authored content (stories and era bookends)

**Context:** Phases A and B ship the chapter player shell and ElevenLabs narration. Both still rely on the existing auto-composed story text — a short paragraph mashup of bio + fact + quote. That is serviceable but flat, and it's the same for every figure. Phase C introduces an authoring system where a Mongolian-speaking writer produces real per-figure stories (3–5 paragraphs) and chapter intro/outro scripts, drafts and publishes them from the Admin Panel, and has them seamlessly replace the auto-compose fallback in the player.

Phase C is mostly content work — the engineering is a thin editorial layer. The spec describes that editorial layer.

## 1. Scope

**In scope**
- New `story_content` table storing authored stories and era bookends, with per-language draft/published status.
- RLS that exposes only published content to non-admins.
- `storyText()` fetches authored text first, falls back to auto-compose when no published row exists.
- Era intro/outro in `StoryChapter` read authored text when available; Phase A stub used as fallback.
- Admin Panel editor for per-figure stories (two textareas: mn / en, each with publish toggle and preview).
- New admin "Eras" tab for era intro/outro authoring (6 eras × 2 langs × 2 kinds = 24 fields).
- Admin preview mode via `?preview=1` query param: admins see their own drafts inline in the player.
- Character counters and estimated narration seconds to help writers stay under target length.

**Out of scope (deferred)**
- Rich-text / markdown editor — stays plain text with paragraph breaks.
- Connective bridge paragraphs between figures within a chapter (the deferred chapter-flow option from Phase A; still deferred).
- Multi-reviewer approval workflow.
- Edit history / rollback / diff.
- AI-assisted drafting or translation automation.
- Separate translation workflow tooling (mn and en are two independent language fields).

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Scope B: per-figure stories + era intros/outros (no bridge paragraphs) | Era bookends already stubbed in Phase A — writers fill them in. Bridge paragraphs are a much larger writing load and require ordering-dependent editing. |
| 2 | Authoring A: Admin Panel editor | Writers shouldn't need git. In-app editing with preview is the shortest path to shipping content. |
| 3 | Status B: per-field draft / published | Public-facing historical content must not leak half-written drafts. Standard editorial model. |
| 4 | Format A: plain text with paragraph breaks | Phase B reads the whole story as one utterance; paragraph-level segmentation adds no value. Escalate to markdown later if writers ask. |

## 3. Data model

### New table `story_content`

Single table covers both scopes via a slug namespace.

```sql
create table story_content (
  slug        text not null,
  -- 'figure:<fig_id>' or 'era_intro:<era_key>' or 'era_outro:<era_key>'
  lang        text not null check (lang in ('mn','en')),
  text        text not null default '',
  status      text not null default 'draft' check (status in ('draft','published')),
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (slug, lang)
);
alter table story_content enable row level security;

create policy "published read" on story_content for select using (status = 'published');
create policy "admin read all" on story_content for select using (is_admin());
create policy "admin write"    on story_content for all    using (is_admin());
```

The `published read` policy lets anon/auth users SELECT only published rows. Admins get full read via the `admin read all` policy (additive — PostgreSQL RLS ORs policies together for the same action). Writes are admin-only.

### Existing columns retire (not drop)

`figures.story` and `figures.story_en` are left in place for backwards compatibility during rollout. After Phase C lands, a follow-up migration drops them. `storyText()`'s existing use of these columns is replaced by a query against `story_content` (see §4).

### Migration content

One migration file `supabase/migrations/<ts>_story_content.sql` creating the table and policies. No data migration needed — existing `figures.story` columns are NULL for all figures.

## 4. Reading path changes

### Fetch strategy — one hook, one query per session

`storyText(figure, lang)` must stay synchronous (existing consumers: `FigureDetail`, `StoryTour`, `StoryChapter`, Phase B narration hook). Introducing an async DB call inside it would break every caller. Instead:

- New React Query hook **`useAuthoredContent()`** in `src/hooks/useAuthoredContent.js`.
- Fetches once per session: `SELECT slug, lang, text, status FROM story_content`. Returns `Map<slug, Map<lang, { text, status }>>`. ~70 rows total (52 figures × 2 langs + 12 era fields); trivial payload.
- Non-admins only see published rows (RLS filters). Admins with `isPreview` context flag see all rows.
- Cached globally; React Query invalidates on admin save/publish to keep preview fresh.

### `storyText(figure, lang, authored?)` — signature grows

```js
export function storyText(figure, lang, authored /* optional Map<slug, {text, status}> */) {
  if (!figure) return '';

  // 1. Authored published content beats everything.
  const slug = `figure:${figure.fig_id}`;
  const entry = authored?.get(slug)?.[lang];
  if (entry?.text) return entry.text;  // RLS already filtered to published (or admin preview)

  // 2. Legacy explicit fields on the figure record (deprecated).
  if (lang === 'en' && figure.story_en) return figure.story_en;
  if (lang !== 'en' && figure.story)    return figure.story;

  // 3. Auto-compose fallback (unchanged).
  return composeFromBioFactQuote(figure, lang);
}
```

- `authored` is optional for backwards compat. Existing `FigureDetail` call sites that don't pass it still work (they fall through to step 2/3).
- New call sites — `StoryChapter` and the Phase B narration pipeline — pass `authored` from `useAuthoredContent()`.

### Era intro/outro in `StoryChapter`
Same source: `useAuthoredContent()` map. Chapter lookup slugs `era_intro:{era}` / `era_outro:{era}` by language. Published row → use `text`. Else → Phase A stub.

### Preview-mode propagation
- URL query `?preview=1` on `/story/:chapter` → React context flag `{ isPreview: true }`.
- `useAuthoredContent()` reads the flag and returns a map that includes draft rows (RLS still lets admins SELECT them).
- A non-admin or unauthenticated user who hand-crafts `?preview=1` is filtered by RLS — `useAuthoredContent()` only gets published rows regardless of the flag. Preview is admin-gated at the data layer, not the UI layer.

### Consumers updated in Phase C
- `src/pages/FigureDetail.jsx` — add `useAuthoredContent()` and pass map to `storyText()`.
- `src/pages/StoryChapter.jsx` (from Phase A) — same.
- `src/pages/StoryTour.jsx` (existing) — same.
- The Phase B narration hook — same.

Every consumer gets authored content automatically once updated.

### Era intro/outro in `StoryChapter`

On chapter load, fetch:
- `story_content` rows for `era_intro:{era}` and `era_outro:{era}` in the active `lang`.
- If published: use `text` as narration.
- If only draft + admin-preview: use `text`.
- Else: fall back to Phase A stub (`"Бүлэг {roman} · {label}. {date_range}. …"`).

### Preview-mode propagation

- URL query `?preview=1` on `/story/:chapter` → React context flag `{ isPreview: true }`.
- `storyText()` and the era-content selector read the flag. In preview, they surface drafts.
- An unauthenticated or non-admin user who manually adds `?preview=1` still gets filtered by RLS — they can't SELECT draft rows, so step 1 misses, step 2 fallback runs. Preview is admin-gated at the data layer, not the UI layer.

## 5. Admin Panel changes

### New figure-story section (inside existing `editor` tab)

Appears below the existing bio/fact/quote fields in the figure editor.

```
Story · Монгол                               [Draft]  [Publish]
┌──────────────────────────────────────────────────────────┐
│  <textarea, ~12 rows, plain text with paragraph breaks> │
└──────────────────────────────────────────────────────────┘
chars: 412 · paragraphs: 3 · est. narration: ~28s       [Preview in chapter]

Story · English                              [Published] [Unpublish]
┌──────────────────────────────────────────────────────────┐
│  <textarea, same treatment>                              │
└──────────────────────────────────────────────────────────┘
chars: 388 · paragraphs: 3 · est. narration: ~26s       [Preview in chapter]
```

- Save button at the top of the editor already exists; it upserts `story_content (slug='figure:<fig_id>', lang=<lang>, text=<textarea>, status=<current>)`.
- **Publish / Unpublish** toggle is a separate control that flips `status` in a dedicated update (doesn't require re-saving the text).
- **Preview in chapter** navigates to `/story/{era}?preview=1&focus={fig_id}`. The Phase A player opens at this figure's slide with admin drafts visible.
- Status pill shows `Draft` (amber) or `Published` (emerald). If the row was published but the textarea has been edited since last save, show `Published · has unsaved changes`.
- Character count, paragraph count, and estimated narration seconds (`round(chars / 15)` as rough TTS rate) appear below each textarea.

### New "Eras" admin tab

New `<TabsTrigger value="eras">` in `AdminPanel.jsx`, rendering `src/components/admin/Eras.jsx`.

Single page with 6 era cards (I–VI). Each card has four textareas:
- `Intro · Монгол` + publish toggle
- `Intro · English` + publish toggle
- `Outro · Монгол` + publish toggle
- `Outro · English` + publish toggle

Each textarea has the same treatment as figure-story textareas (char/paragraph count, preview button).

- **Preview era intro** → `/story/{era}?preview=1&s=0` (intro slide).
- **Preview era outro** → `/story/{era}?preview=1&s=<lastSlide>`.
- Save/publish per field; no "publish all" button (intentional friction to prevent accidental mass-publish).

### Writing aids (cheap)

- Character count + estimated narration seconds under each textarea.
- Amber warning chip on any draft older than 30 days: `"Still in draft since {date}"`.

### i18n additions

New `admin.stories.*` and `admin.eras.*` keys (both `mn` and `en`):
- `admin.stories.title`, `admin.stories.storyMn`, `admin.stories.storyEn`, `admin.stories.publish`, `admin.stories.unpublish`, `admin.stories.preview`, `admin.stories.draft`, `admin.stories.published`, `admin.stories.unsaved`, `admin.stories.charsAndTime`, `admin.stories.oldDraftWarning`.
- `admin.eras.tabTitle`, `admin.eras.intro`, `admin.eras.outro`, `admin.eras.previewIntro`, `admin.eras.previewOutro`.

## 6. Failure paths

- `story_content` query fails (network / DB down): `storyText()` logs and returns the auto-compose fallback silently. Chapter still plays.
- RLS misconfigured (regression): published content doesn't show. Caught by smoke test.
- Admin publishes empty text: treated the same as no published row (step 1 returns empty, falls through to step 2). Admin UI shows warning if publishing empty text.

## 7. Testing

### SQL smoke tests (append to `supabase/tests/rls_smoke.sql`)
- Non-admin INSERT/UPDATE/DELETE on `story_content` → denied.
- Non-admin SELECT on a draft row → returns 0 rows.
- Non-admin SELECT on a published row → returns 1 row.
- Admin SELECT on draft + published → returns all rows.
- Publishing (UPDATE status='published') by admin → succeeds.

### Vitest
- `storyText(figure, lang)` returns auto-compose fallback when no published `story_content` row exists.
- `storyText(figure, lang)` returns authored text when a published row exists.
- With `isPreview: true` context flag, `storyText()` returns draft text when a draft row exists.
- Admin story editor save triggers correct upsert payload.
- Publish toggle flips `status` without touching `text`.
- Character counter and narration-seconds estimator compute correctly.

### Manual
- Author a figure story in admin → save draft → verify it does NOT appear in `/story/{era}` for a regular user.
- Click "Preview in chapter" from admin → verify draft text narrates in player.
- Publish the story → refresh `/story/{era}` as non-admin → verify authored text narrates.
- Publish an era intro → refresh chapter → verify intro slide uses authored text instead of stub.
- Verify Phase B cache regenerates when text changes (first play of newly-published story shows `source: 'synth'`, subsequent plays `source: 'cache'`).

## 8. Risks and mitigations

- **Writers accidentally exposing drafts via `?preview=1`:** RLS gate means non-admins in preview still can't read drafts. Low risk.
- **Per-language status drift:** a figure might have `mn` published but `en` still draft. Desired behavior — language-independent publish is the whole point. Admin UI shows both statuses side by side so drift is visible.
- **Estimated narration seconds misleading:** `chars/15` is an approximation; actual ElevenLabs pace varies. Accept the approximation; frames the writing target, not a promise.
- **Large paragraph counts breaking subtitle chunking in Phase A:** Phase A chunks on sentence boundaries, not paragraphs, so a 5-paragraph story renders fine. No change needed.
- **Legacy `figures.story` column still present during rollout:** `storyText()` no longer reads it after this phase. If any other consumer (seed scripts, tests) reads it directly, audit and update in the same commit. Dropped in a follow-up migration after rollout is confirmed.

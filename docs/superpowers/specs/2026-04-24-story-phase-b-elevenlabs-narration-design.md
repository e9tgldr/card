# Story — Phase B: ElevenLabs narration with per-figure character voices

**Context:** Phase A ships the chapter player with browser-TTS narration (robot voices, uneven language support, no cache). Phase B upgrades the voice layer to ElevenLabs. The codebase already has a `speak` edge function (from the QR-to-AI flow) that takes `{ text, lang }`, calls ElevenLabs, and caches the audio file in the public-read `voice-cache` storage bucket. Secrets `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID_{MN,EN,CN}` are already set. `StoryPlayer.jsx` already supports two modes — `<audio>` element if an URL is provided, browser SpeechSynthesis otherwise — so the client-side swap is a plug-in, not a rewrite.

Phase B adds per-figure character voices on top of this foundation: when a figure has a voice assigned, the entire figure slide is read in that voice (dramatic-reader convention — the figure narrates their own story in third person). Intro/outro slides and figures without a voice assignment use the language-level narrator voice already wired up.

## 1. Scope

**In scope**
- New `figure_voices` DB table mapping figure × language → ElevenLabs voice ID.
- `speak` edge function gains:
  - Optional `voice_id` override in the request body.
  - Authenticated-user rate-limit bucket (60/hr/user) separate from the existing anonymous bucket (10/hr/IP).
  - `source` field in the response (`'cache' | 'synth' | 'fallback'`).
- `StoryPlayer.jsx` (and `StoryChapter` from Phase A) route narration through `speak`; cascade fallback on failure (character voice → narrator voice → browser TTS → silent text).
- Background pre-fetch: when a chapter opens, prime the `speak` cache for slides 2..N in parallel (max 3 concurrent) while slide 1 plays.
- Admin Voices tab: table of figures × langs, per-cell voice ID input with preview, plus a "Pre-render chapter" button per era that walks the playlist and fills the cache.
- Cascade fallback for any synthesis failure.

**Out of scope (deferred)**
- Voice library browser UI against ElevenLabs API.
- Per-era narrator voices (still one narrator voice per language).
- Mid-sentence voice switches (narrator starts, figure finishes) — requires audio stitching.
- Voice cloning / custom voices.
- Segment-level voice switching for quoted lines inside a figure story (Phase C C2 decision: whole story in one voice).

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | C2 voice casting: whole figure story in that figure's voice when assigned; narrator for intro/outro and unassigned figures | Dramatic-reader convention. Figure narrates their own third-person story. Avoids segment-stitching complexity. |
| 2 | Hybrid cold-start (D): client auto pre-fetch on chapter open + admin "Pre-render chapter" button + lazy fallback | Pure lazy feels janky on first playthrough. Pre-fetch while slide 1 plays solves 90% of UX automatically. Admin button + lazy are belts and braces. |
| 3 | Dedicated `figure_voices` DB table | Voice selection is iterative and aesthetic; admins re-cast frequently. Code-and-deploy is wrong friction. Separate table keeps voice curation away from bio editing. |
| 4 | Cascade fallback + 60/hr authed rate limit | The Story requires real voices every time. Bumping the authed limit prevents a chapter pre-warm from instantly hitting the 10/hr anonymous cap. Cascade ensures ElevenLabs outages or invalid voice IDs still produce sound. |

## 3. Data model

### New table `figure_voices`

```sql
create table figure_voices (
  fig_id      int  not null,
  lang        text not null check (lang in ('mn','en','cn')),
  voice_id    text not null,
  sample_url  text,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (fig_id, lang)
);
alter table figure_voices enable row level security;

create policy "voices public read" on figure_voices for select using (true);
create policy "voices admin write" on figure_voices for all    using (is_admin());
```

No FK to a `figures` table (figures are managed client-side via `figuresData.js`; `fig_id` is just an integer reference).

### Existing `voice-cache` storage bucket
- Public read, service-role write. No changes needed.
- Object keys remain `sha256(lang|voice_id|text)`. Because cache keys include `voice_id`, per-figure voices naturally shard without cache collisions.

### Existing `rate_limits` table (from QR-AI flow)
- Reused. Key pattern changes to distinguish anon vs authed:
  - Anon: `ip_hash = sha256(ip+ua)`, `endpoint = 'speak'`.
  - Authed: `ip_hash = 'user:' || auth.uid()`, `endpoint = 'speak'`.
- Quotas: 10/hr for anon, 60/hr for authed. Hour bucket: `floor(epoch / 3600)`.

## 4. Edge function changes: `speak`

### Request body
```ts
{
  text: string,
  lang: 'mn' | 'en' | 'cn',
  voice_id?: string         // optional override; else uses ELEVENLABS_VOICE_ID_{LANG}
}
```

### Logic
1. Parse JWT from `Authorization` header. If valid and a user is found → `userId = user.id`. Else → anonymous.
2. Determine effective `voice_id`: body value if provided, else env default for `lang`.
3. Compute cache key `sha256(lang|voice_id|text)`.
4. Check `voice-cache` bucket: if object exists, return `{ url, source: 'cache' }`.
5. Rate-limit check:
   - If authed: bucket key `user:${userId}`, quota 60/hr.
   - If anon: bucket key from IP hash, quota 10/hr.
   - Over quota → return `{ source: 'fallback', reason: 'rate_limited' }` with 429. Client cascades to browser TTS.
6. Call ElevenLabs API with `voice_id` and `text`. On error (network, 4xx, 5xx): return `{ source: 'fallback', reason: 'upstream_error' }` with 502.
7. On success: upload audio to `voice-cache` bucket under cache key. Write a row to `rate_limits`. Return `{ url, source: 'synth' }`.

### Response shape
```ts
{ url?: string, source: 'cache' | 'synth' | 'fallback', reason?: string }
```

- `source: 'cache'` or `'synth'` → `url` is the public Supabase Storage URL.
- `source: 'fallback'` → no URL; client should cascade (retry with narrator `voice_id`, then browser TTS).

### JWT handling
- `verify_jwt: false` on this function (anonymous QR-AI callers still work). The function itself parses the header to distinguish authed vs anon, using `supabase.auth.getUser(jwt)` to validate.

## 5. Client integration

### New hook `useVoices`
```js
// src/hooks/useVoices.js
export function useVoices(lang) {
  // Fetches figure_voices rows for the given lang once, caches in a React Query entry.
  // Returns a function: voiceIdFor(figId) -> string | null.
}
```
Called once from `StoryChapter` on mount; result passed down to the narrator.

### `useNarration` hook (extracted in Phase A; modified here)
All narration goes through the shared `useNarration` hook from Phase A. Phase B modifies the hook — every downstream consumer (`StoryPlayer`, `StoryChapter`) benefits automatically.

For each utterance requested of the hook:
1. Compute `voice_id`:
   - Intro / outro / figure-without-mapping → omit `voice_id` (server uses language narrator default).
   - Figure-with-mapping → use the mapped `voice_id`.
2. Call `/functions/v1/speak` with `{ text, lang, voice_id? }`.
3. On `source: 'cache' | 'synth'` + `url` → play via `<audio>` element (existing code path).
4. On `source: 'fallback'`:
   - First failure (character voice): re-call `speak` without `voice_id` (narrator).
   - Second failure (narrator): fall back to browser `speechSynthesis` (existing code path in the hook).
   - Third failure (no TTS support at all): show text silently; autoplay advances via existing text-length timer.

The hook exposes the same interface Phase A defined — `play/pause/stop/status/progress/onDone/onBoundary` — so no changes at the call site.

### Background pre-fetch
On `StoryChapter` mount, after the first slide starts playing:
- Queue all remaining slides' `speak` calls with `Promise.allSettled` and a concurrency limit of 3 (simple in-memory semaphore).
- Ignore responses (just warming cache). Failures are silent.
- Skip if `navigator.connection?.saveData` is true (respect Data Saver).

### Session handling
- Nothing new. `StoryChapter`'s existing session-resume logic is untouched.

## 6. Admin "Voices" tab

### Location
New `<TabsTrigger value="voices">` in `AdminPanel.jsx`, rendering a new `AdminVoices` component from `src/components/admin/Voices.jsx`.

### Layout
Table with one row per figure. Columns: `Figure name · mn · en · cn · actions`.

- Each language cell shows either the current voice ID (shortened, e.g., `vid_abc…xyz`) with a small 🎙 icon, or an empty "— assign —" state.
- Above the table: a "Has quote" filter chip (defaults on) so admins focus on the 7 figures that currently have quotes.
- Per-era "Pre-render chapter" button at the top: walks every slide in that chapter's playlist, fires `speak` for each text+voice combination, shows `N / M rendered` progress. This is the manual lever for the Phase B "D" cold-start strategy.

### Edit modal (click a cell)
- `voice_id` text input (paste ID from ElevenLabs dashboard).
- **Preview** button: calls `speak` with a 1-line sample sentence (`"Би бол {figure.name}."` / `"I am {figure.name}."`) in this voice. Plays inline via `<audio>`. Cached — repeated previews are free.
- **Save** button: upserts `figure_voices` row via direct `supabase.from('figure_voices').upsert(...)` (RLS allows admin writes).

No voice-library browser inside the app — admins paste IDs from their ElevenLabs dashboard.

### New i18n strings (`admin.voices.*`)
`title`, `assign`, `preview`, `save`, `preRender`, `preRendering`, `hasQuoteFilter`, `none`, `voicePlaceholder`.

## 7. Failure modes and cascade

| Failure | Response | Cascade |
|---|---|---|
| Character voice_id invalid / ElevenLabs 4xx | `speak` returns `source: 'fallback'` | Client re-calls `speak` without `voice_id` (narrator) |
| Narrator voice also fails | Client receives `source: 'fallback'` again | Fall back to browser `speechSynthesis` |
| Browser has no TTS (`speechSynthesis` undefined) | | Show text silently; autoplay via existing text-length timer |
| ElevenLabs API down (5xx / network) | `speak` returns `source: 'fallback'` | Same cascade as invalid voice |
| Authed user hits 60/hr quota | `speak` returns 429 + `source: 'fallback'` | Same cascade; toast "Synthesizing… (fallback)" shown once per chapter |
| Storage upload fails | `speak` returns `source: 'synth'` without `url` | Client treats as fallback |

Cascade retries happen in-client; the edge function is simple and always returns either a URL or a fallback marker.

## 8. Testing

### SQL smoke tests (append to `supabase/tests/rls_smoke.sql`)
- Non-admin INSERT/UPDATE/DELETE on `figure_voices` → denied.
- Non-admin SELECT on `figure_voices` → returns rows (public read).
- Admin all CRUD → allowed.

### Edge function tests
- `speak` without JWT, no cache → counts against IP bucket (10/hr).
- `speak` with valid JWT, no cache → counts against `user:${uid}` bucket (60/hr).
- `speak` with cache hit → returns `source: 'cache'`, no synth, no rate-limit increment.
- `speak` with invalid `voice_id` → calls ElevenLabs, ElevenLabs errors → returns `source: 'fallback'`.
- `speak` at quota → returns 429 + `source: 'fallback'`.
- `speak` with rate-limit DB write failure → fail-open (still synths; skips rate-limit row).

### Vitest
- `useVoices(lang)` fetches `figure_voices` rows and returns correct `voice_id` per figure.
- Narrator picks character voice when assigned; narrator voice when not.
- Cascade: character-voice failure triggers narrator call; narrator failure triggers browser TTS.
- Background pre-fetch fires `speak` for slides 2..N with max-3 concurrency; Data Saver mode skips pre-fetch.

### Manual
- Play a chapter end-to-end with mixed assigned/unassigned figures; verify voice switches between narrator and character voices as expected.
- Cut network to ElevenLabs mid-chapter (browser dev-tools "offline" for specific request) → verify browser-TTS fallback kicks in with no visible error toast.
- Admin voice preview plays correctly, preserves cache on repeat.
- Pre-render chapter button: open Network tab, verify all slide texts hit `speak`, progress count matches.

## 9. Risks and mitigations

- **ElevenLabs cost runaway:** an over-eager admin could kick off 52-figure × 3-lang × 2-segments (intro/outro) pre-renders in a loop. Mitigation: the pre-render endpoint is just chained `speak` calls, which hit the 60/hr user quota naturally. Add a warning modal before "Pre-render chapter" confirming the approximate cost in characters.
- **Voice ID typos silently fall back to narrator:** admin pastes wrong ID, cascade succeeds with narrator, admin thinks nothing is wrong. Mitigation: the edit-modal "Preview" button is the validation — if preview plays nothing, the ID is wrong. Document this in the admin UI.
- **Cache ballooning:** cache has no TTL. 52 figures × 3 langs × ~300 words × 2-5 KB/minute ≈ manageable (~tens of MB). Not an issue in practice; revisit if storage cost surfaces.
- **Text changes (Phase C) invalidate cache implicitly:** when a published story changes text, the new `sha256` hash misses cache and triggers fresh synth. Desired behavior.
- **Rate-limit hash collisions:** `user:${uid}` key is unique per user; no collisions. Anon uses existing IP-hash scheme.

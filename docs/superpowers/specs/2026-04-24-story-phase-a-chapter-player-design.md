# Story — Phase A: Chapter player (structural shell)

**Context:** The existing `/tour` StoryTour walks all 52 figures sequentially with browser-TTS narration. It's functional but flat — no arc, no pacing, no visual richness. The user wants a full "Ken Burns documentary" story experience. Because that's a large scope, it is decomposed into three sequential phases:

- **Phase A (this spec)** — chapter-based structural shell with visual layer. Ships without ElevenLabs, without handwritten content.
- **Phase B** — swap browser TTS for ElevenLabs narration with per-figure character voices. Separate spec.
- **Phase C** — handwritten per-figure stories and era bookends. Separate spec.

Phase A builds the container that B and C pour content into.

## 1. Scope

**In scope**
- New route `/story/:chapter` that plays an era as a sequence of slides (intro → per-figure → outro).
- Hybrid presentation: inline editorial mode (stays in codex page layout) and fullscreen cinematic mode (toggle button).
- Visual layer: Ken Burns portrait pan + zoom, adjacent map panel that pans to the current figure's region, live subtitle overlay driven by narration progress.
- Simple playlist flow (intro, figures, outro) with thin era-specific "act" labels that segment the playlist.
- Persistent controls bar: play/pause, prev/next, scrubber, slide counter, fullscreen toggle.
- Keyboard shortcuts: space, ←/→, F, Esc.
- Session-only progress via `sessionStorage`.
- Deep-linkable slides via `?s=<slideIdx>` query param.
- Entry point: augment the existing `ChaptersSection` on Home with a "▶ Play this chapter" CTA per era. No new nav item.
- Ending card: "chapter complete" + manual "Continue to next era" link.

**Out of scope (deferred)**
- ElevenLabs narration (Phase B).
- Handwritten per-figure stories and era bookend scripts (Phase C).
- Connective narration between figures within a chapter.
- Synchronized date callouts.
- Ambient background music.
- DB-backed progress tracking.
- Deleting or redirecting the existing `/tour` StoryTour (leave alone; additive).

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | 6 chapters = 6 eras (founding, expansion, yuan, northern, qing, modern) | Eras already defined in `figuresData.js` (`ERAS`, `ERA_KEYS`, `getEra`). Natural fit. |
| 2 | Hybrid presentation (inline + optional fullscreen) | Codex aesthetic is the brand; always-fullscreen feels off. Users can opt into the cinematic view. |
| 3 | Simple playlist (intro → figures → outro) | Requires zero new authored writing. Phase C can add connective tissue later. |
| 4 | Portrait + map panel | Uses existing `front_img` and `HistoricalMap`. Richer than text-only without asset work. |
| 5 | Autoplay with always-visible controls | Documentary default; avoids mode toggle. |
| 6 | Session-only progress (`sessionStorage`) | DB-backed resume is premature. One key: `story:resume = { chapter, slideIdx }`. |
| 7 | Entry: augment `ChaptersSection` with per-era Play CTA | No new nav item, no new home block. Discovery rides existing surface. |
| 8 | Act-label metadata layer | Thin sublabels (e.g. "The Unifier") group figures within a chapter; controls bar shows current act. No new content. |
| 9 | Cross-chapter navigation is manual | Ending card offers "Continue to {next era}" but does not auto-advance. Prevents endless autoplay. |

## 3. Architecture

### Routes
- **`/story/:chapter`** — player page. `:chapter` ∈ `ERA_KEYS`. `?s=<slideIdx>` optional deep-link.
- **`/story`** (no chapter) — redirects to `/#chapters`.

### Component tree (new files under `src/pages/` and `src/components/story/`)
- **`src/pages/StoryChapter.jsx`** — page route; owns playlist + playback state; toggles inline vs fullscreen. Renders `StoryStage` + `StoryControls`. Uses `useNarration` for audio/TTS.
- **`src/components/story/StoryStage.jsx`** — visual area: `KenBurnsPortrait` + `StoryMapPanel` + `Subtitles`. Receives the current `Slide` and the narration progress value.
- **`src/components/story/StoryControls.jsx`** — persistent control bar. Same controls used in both modes.
- **`src/components/story/KenBurnsPortrait.jsx`** — framer-motion slow pan+zoom on `figure.front_img`. Sepia vignette overlay.
- **`src/components/story/StoryMapPanel.jsx`** — wraps existing `HistoricalMap` with a `focus` prop.
- **`src/components/story/Subtitles.jsx`** — text overlay fed by narration `onboundary` events and a progress value.
- **`src/lib/storyPlaylist.js`** — pure function `buildChapterPlaylist(chapterKey)` returning `Slide[]`; act-label metadata here.
- **`src/hooks/useNarration.js`** — extracted narration engine (TTS-first; `<audio>` if a URL is provided). Exposes `play`, `pause`, `stop`, `status`, `progress`, `onDone`, `onBoundary`. Phase A implementation is lifted verbatim from the existing `StoryPlayer.jsx`. Phase B swaps its audio source without changing the interface.

### Touched existing files
- **`src/App.jsx`** — register `/story/:chapter` route inside the auth-gated section.
- **`src/components/ChaptersSection.jsx`** — add "▶ Энэ бүлгийн түүхийг үзэх / Play this chapter" CTA to each era header, navigating to `/story/{era}`.
- **`src/lib/figuresData.js`** — add a small `ERA_OVERVIEWS` map (one ~3-sentence intro per era) and `ACTS` map (`{ era_key: { fig_id: act_label } }`). Stub content; Phase C replaces the era overviews.
- **`src/lib/i18n.jsx`** — new `story.*` i18n keys.
- **`src/components/StoryPlayer.jsx`** — refactored to delegate narration to `useNarration`. Its block/button UI variants stay in place on `FigureDetail` and the existing `StoryTour`. No behavior change for existing consumers.

## 4. Data flow

### Slide model

```ts
type Slide =
  | { kind: 'intro'; era: string; act?: string }
  | { kind: 'figure'; figure: Figure; act?: string }
  | { kind: 'outro'; era: string };
```

### Playlist build (pure function, no side effects)

```js
function buildChapterPlaylist(chapterKey) {
  const figures = FIGURES
    .filter(f => getEra(f) === chapterKey)
    .sort((a, b) => a.fig_id - b.fig_id);
  const acts = ACTS[chapterKey] ?? {};   // { figId -> actLabel }
  const figureSlides = figures.map(f => ({ kind: 'figure', figure: f, act: acts[f.fig_id] }));
  return [
    { kind: 'intro', era: chapterKey, act: figureSlides[0]?.act },
    ...figureSlides,
    { kind: 'outro', era: chapterKey },
  ];
}
```

### Narration text per slide (Phase A sources only — Phase C overrides these)

- `intro` slide → `"Бүлэг {roman} · {label}. {date_range}. {ERA_OVERVIEWS[era][lang]}"`.
- `figure` slide → existing `storyText(figure, lang)` (unchanged).
- `outro` slide → template: `"Бүлэг {roman} дуусав. Дараагийн бүлэг: {nextRoman}."`. Last chapter: `"Кодекс дуусав."`.

### Playback state machine (internal to `StoryChapter`)

```
state = { slideIdx: number, status: 'idle' | 'playing' | 'paused' | 'done', isFullscreen: boolean }
```

- Narrator for current slide → `StoryPlayer` (existing component). Its `onDone` → `advance(+1)`.
- `prev/next`: seek ±1 slide, restart narration.
- `slideIdx === playlist.length` → `status = 'done'`, show ending card.
- Query param `?s=N` overrides `sessionStorage` resume.
- On mount, load resume from `sessionStorage['story:resume']`; if stored `chapter` matches URL, start at stored `slideIdx`; else 0.
- On every `slideIdx` change AND on `beforeunload`, persist `{ chapter, slideIdx }` to `sessionStorage`.

### Navigation contract
- `prev` at slideIdx=0 → no-op.
- `next` at last slide → advance to "done" state (not into next chapter).
- Ending card's "Continue to next era" click → `navigate('/story/{nextEra}')`.

## 5. Visual layer

### Inline mode (default)
```
┌────────────────────────────────────────────────────────────┐
│  ⚜  БҮЛЭГ I · ҮҮСЭЛ            3 / 11 · ЭРДМИЙН АЯН        │  chapter header + act label
├────────────────────────────────────────────────────────────┤
│   ┌──────────────────┐    ┌─────────────────┐              │
│   │    PORTRAIT      │    │      MAP        │              │
│   │  Ken Burns pan   │    │  focus: region  │              │
│   │  + sepia vignette│    │  (HistoricalMap)│              │
│   └──────────────────┘    └─────────────────┘              │
│                                                            │
│  БӨРТЭ ҮЖИН · 1161–1230                                   │  slide caption
│  ──────────────────────                                    │
│  Narration subtitles appear here, fading as narration     │
│  progresses. 2–3 lines visible at once.                   │
├────────────────────────────────────────────────────────────┤
│ ◀  ▶  ━━━━━━━━━╋━━━━━━━━━━  3/11  ⛶                       │  persistent controls
└────────────────────────────────────────────────────────────┘
```

### Fullscreen mode
- Triggered by the ⛶ button in controls.
- Portrait dominates the viewport; map shrinks to a corner inset; subtitles bottom-center with higher contrast.
- Dark-sky background covers codex chrome.
- Controls auto-hide after 3s of mouse inactivity; return on mousemove / keyboard activity.
- Esc exits.

### Ken Burns (portrait)
- framer-motion infinite slow pan + gentle zoom per figure. 20-second cycle: `scale: 1.0 → 1.08`, `translate: ±3% X + ±2% Y`.
- 600ms cross-fade between slides.
- Sepia vignette overlay for palette consistency across disparate source images.

### Map panel
- Uses existing `HistoricalMap` component extended with a `focus: { lat, lng, zoom }` prop.
- New `FIGURE_GEO` map added to `src/lib/mapData.js`: `{ [fig_id]: { lat, lng, zoom } }`. Heartland default for founding-era khans, Persia for Hulagu, Dadu/Beijing for Kublai, etc.
- Smooth pan (1.5s ease-in-out) when the current slide changes.
- If no geo mapping exists for a figure, map keeps the era's characteristic focus (defined per-era in the same file).

### Subtitles
- Driven by `SpeechSynthesisUtterance.onboundary` events (already used in `StoryPlayer`).
- Chunk the full text into 2–3 sentence cards, fade in as `charIndex / text.length` crosses each card's start.
- If the browser fires no boundary events, fall back to showing the full text statically (no subtitle highlighting).
- Font: codex display serif at `text-[17px]`.

### Ending card
- Final outro line fades over a low-sepia title card: **"БҮЛЭГ {roman} ДУУСАВ"**.
- After 2s, glowing link card appears: **"Үргэлжлүүлэх: {nextRoman} · {nextLabel} →"** with the next era's fleuron icon.
- Manual click → `/story/{nextEra}`. No auto-advance.
- Last chapter (`modern`): shows "Кодекс дуусав. Баярлалаа." instead, with a link back to `/#chapters`.

## 6. Keyboard

| Key | Action |
|---|---|
| Space | Play / pause |
| ← | Previous slide |
| → | Next slide |
| F | Toggle fullscreen |
| Esc | Exit fullscreen |

## 7. Error paths

- Unknown `:chapter` param → `navigate('/#chapters')` with toast "Бүлэг олдсонгүй / Chapter not found".
- TTS unavailable → existing `StoryPlayer` fallback (show text; autoplay advances on a timer using `Math.max(4000, text.length * 50)` ms).
- No figures in the era (shouldn't happen, but defensive) → show "Бүлэг хоосон байна / Chapter is empty".

## 8. Testing

### Vitest
- `buildChapterPlaylist(chapterKey)` returns `[intro, ...figureSlides, outro]` with figures sorted by `fig_id`.
- Act labels attach to the correct slide indexes.
- Session resume round-trips via `sessionStorage`; `?s=` query param overrides stored resume.
- Keyboard handler fires the right state transitions (space toggles status, arrows seek, F toggles fullscreen, Esc exits).
- Subtitle chunking splits on sentence boundaries and progresses with fake boundary events.

### Manual QA
- Visual: inline + fullscreen on desktop and mobile; map pan smoothness; Ken Burns doesn't jump on cross-fade.
- Navigation: prev at slide 0 no-op; next at last slide shows ending card; deep link `/story/founding?s=3` opens at Börte.
- Entry: the new "Play this chapter" CTA in `ChaptersSection` lands on the correct URL.
- Existing features untouched: `FigureDetail`'s StoryPlayer, `/tour` StoryTour, Home ChaptersSection figure tiles.

## 9. i18n additions

New `story.*` keys (both `mn` and `en`):
- `story.play`, `story.pause`, `story.prev`, `story.next`, `story.fullscreen`, `story.exitFullscreen`
- `story.chapter`, `story.act`, `story.slideOf` (`"{n} / {total}"`)
- `story.intro.label`, `story.outro.label`
- `story.ending.title`, `story.ending.continue`, `story.ending.done`
- `story.empty`, `story.notFound`
- `nav.story` (if used by ChaptersSection CTA)
- `chapters.playChapter`

## 10. Risks and mitigations

- **Performance of Ken Burns + map + subtitle updates together:** all three animate concurrently. Mitigation: use `transform`/`opacity` for the pan/zoom (GPU-compositable), debounce map focus on rapid prev/next, cap subtitle re-renders via `useMemo`.
- **`HistoricalMap` focus prop may not exist yet:** add it as part of this phase if it doesn't; low-risk change since no other consumer sets focus today.
- **Sepia vignette clashing with existing portraits:** parameterize the vignette strength; tune during manual QA.
- **Fullscreen on iOS Safari:** native Fullscreen API is flaky. Fall back to a CSS-based pseudo-fullscreen (`position: fixed; inset: 0`) when `document.fullscreenEnabled` is false.

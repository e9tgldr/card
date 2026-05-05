# Hero Redesign — `/` and `/app` photo-led editorial (National Geographic feel)

**Context:** The Stitch black/gold/bronze redesign of `LandingV2.jsx` (`/`) and `HomeV2.jsx` (`/app`) shipped 2026-05-03 and is functionally complete but visually flat. An earlier ornamented-codex (Cormorant + gilt + drop-cap + particle field + rotating medallion) attempt was implemented and reverted on 2026-05-05 because the direction did not land. Replacement direction (this spec): **photo-led editorial** modeled on National Geographic — full-bleed sepia portrait, single yellow accent rule, Fraunces serif headline, Inter kicker/body. The hero photo of a featured figure rotates daily.

The redesign is hero-only — sections below the hero (HowItWorks, ExploreFigures, Engagements, Chapters, Pricing) keep their current Stitch styling and palette. The yellow accent in the hero is allowed to mild-clash with the gold accents below; treated as "magazine cover above the fold, content below."

## 1. Scope

**In scope**
- Replace the `Hero({ c })` component in `src/pages/LandingV2.jsx` and `src/pages/HomeV2.jsx`.
- Add Fraunces display face via Google Fonts `<link>` in `index.html`. Inter stays for body/UI. No metric-fallback `@font-face` needed — body is sans, only headlines are serif and brief font-swap shift on the hero is acceptable.
- New `tokens.serif` constant per page (inlined alongside the existing `tokens` block, matching the page-local pattern). Value: `'"Fraunces", "Source Serif 4", "EB Garamond", Georgia, serif'`.
- New `tokens.accent` constant per page: `'#FFCC00'`. The portrait sepia gradient stops are inlined inside `SepiaPortrait` (no separate token bundle).
- New shared hook `src/hooks/useFeaturedToday.js` — deterministic daily-rotation pick from `FIGURES` (uses a date-of-year modulo so the same figure shows for everyone today, changes at midnight UTC). Returns one `Figure` object.
- New shared component `src/components/photo/SepiaPortrait.jsx` — wraps a figure portrait with sepia gradient, film-grain overlay (CSS only, no canvas), and a vignette. Accepts `figure`, `aspectRatio`, `size`, optional `caption` slot.
- Landing hero: full-bleed sepia portrait + yellow accent rule + Fraunces headline + MN lede + yellow-fill primary CTA + underlined ghost link + italic photo caption bottom-right.
- App hero (the `/app` page header): smaller — left 32% photo strip + right 68% type column. Same elements minus the bottom caption (replaced by a thin "Featured: <name>" strip across the bottom of the hero section).
- New tests: `useFeaturedToday` (deterministic by date), `SepiaPortrait` (renders an `<img>` with `alt`, applies CSS filters, has `aria-hidden` overlay layers), and 2 new hero smoke tests per page.

**Out of scope (deferred)**
- Sections below the hero (HowItWorks, Pricing, ExploreFigures, etc.). Untouched.
- Replacing Inter for body. Display-only swap.
- Animation. The hero is static. No rAF, no IntersectionObserver, no rotating crossfade. The "rotates daily" rotation is server-time-based, not animated within a session.
- Mobile-specific redesign. Existing `clamp()` rules + an updated single `@media (max-width: 880px)` block in each file handle mobile (full-bleed portrait stacks above the type column).
- The legacy `/v1` / `/v1/app` pages.
- Per-card flourishes anywhere.
- A new theme extraction. Inline tokens stay inline.

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Photo-led editorial direction (NatGeo). | Brainstorm pick F. The previous ornamented direction did not land in browser. |
| 2 | Fraunces for display, Inter for body/UI. Loaded via Google Fonts `<link>`. No metric fallback needed. | Free, broad weight + optical-size axes. Body sans means font-swap on display headlines is acceptable. |
| 3 | Single yellow accent `#FFCC00`. | One color does the editorial work; more would muddy the photo. |
| 4 | Daily rotation, deterministic by `Date()` modulo `FIGURES.length`. No animation. | Same figure for everyone today; changes at midnight UTC. Simple, testable, cacheable. |
| 5 | Photo treatment is CSS only — `filter: sepia(0.3) contrast(1.05)` + radial gradient overlay + 3px-tile dotted SVG mask for grain + inset box-shadow vignette. No canvas. | Cheap, no rAF, no DPR concerns, accessible (just an `<img>` with `alt`). |
| 6 | Landing hero is one big portrait full-bleed; existing `HeroVisual` 3-card stack is **removed**. | The whole point of the direction is the photo doing the work. Stack would compete. |
| 7 | App hero is a banner (32%/68% split), not a full-screen header. | `/app` content density is high. A full-screen hero on `/app` would push real content off the fold. |
| 8 | "Featured today" caption shows figure name + birth/death years + a static byline ("From the Codex collection"). No external photo-source attribution (portraits are project assets). | Honest framing; no fake authority. |
| 9 | Existing test assertions on `/Их Монгол Улсын/`, `/түүхийн хөзөр/`, `/Алтан Домогийн/`, `/^нүүр$/`, CTA hrefs must keep passing without rewrite. The Mongolian title strings stay as-is in COPY. | Smoke contracts. The redesign keeps the literal title text; only the typography + composition change. |
| 10 | `Hero` no longer takes `figureCount` prop; all featured-figure data comes via `useFeaturedToday()` called inside `Hero`. The kicker text "52 figures · 3 languages" is still rendered, but is just a string constant. | Decouples hero from the figures-list query. Avoids a parent re-render pipeline through `figures.length`. |

## 3. Architecture

### File layout

```
src/components/photo/
  SepiaPortrait.jsx        // <SepiaPortrait figure aspectRatio size caption?/>
  __tests__/
    SepiaPortrait.test.jsx

src/hooks/
  useFeaturedToday.js      // useFeaturedToday() → Figure
  __tests__/
    useFeaturedToday.test.js

src/pages/
  LandingV2.jsx            // Hero rewritten + HeroVisual REMOVED + new tokens
  LandingV2.test.jsx       // +2 new tests
  HomeV2.jsx               // Hero rewritten + new tokens
  HomeV2.test.jsx          // +2 new tests

index.html                 // +Fraunces Google Fonts <link>
```

### Primitive contracts

**`useFeaturedToday() → Figure`** — pure deterministic pick.

```js
// pseudocode
const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
return FIGURES[dayIndex % FIGURES.length];
```

- Deterministic by date. Same UTC day → same figure for all users.
- Returns the project's existing `FIGURES[i]` shape: `{ fig_id, name, portrait_url, role, years, ... }`.
- No memoization needed (it's already pure + hits a tiny array).
- Tests can stub `Date.now()` to a fixed timestamp and assert which figure is returned.

**`<SepiaPortrait figure aspectRatio size caption?>`** — visual primitive.

- Renders an `<img src={figure.portrait_url} alt={figure.name}>` inside a `<div>` with the sepia + grain + vignette layered on top via stacked `<div aria-hidden="true">` overlays.
- `filter: sepia(0.3) contrast(1.05) saturate(0.9)` on the `<img>`.
- Overlay 1 (sepia tint): `linear-gradient(180deg, rgba(180,150,110,0) 0%, rgba(80,50,30,0.25) 65%, rgba(20,12,6,0.55) 100%)`.
- Overlay 2 (grain): a small inline SVG `data:` URL of dotted noise, repeated.
- Overlay 3 (vignette): `box-shadow: inset 0 0 200px 50px rgba(0,0,0,0.6)`.
- All overlays `pointer-events: none`, `aria-hidden="true"`.
- `caption` prop renders below the image, left-aligned, italic Inter, color rgba(255,255,255,0.5), with a yellow `<span>` for emphasis tags.

### Page application

**`index.html`** — add inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" />
```

**`LandingV2.jsx`** Hero — replace the existing `Hero` and remove `HeroVisual`:

- Wrapping `<section>` keeps current padding + `position: relative; overflow: hidden;`.
- Inside: `<SepiaPortrait figure={featured} aspectRatio="16/9" size="full" />` covering the entire hero section as a backdrop (absolutely positioned `inset: 0`).
- Top-left: a 48×5px yellow `<div>` (`tokens.accent` background).
- Top-right: brand wordmark "Codex I · 2026" in Inter caps tracked-out.
- Bottom-left content stack:
  - Caps kicker: "The Mongol Empire · 1206–1368" in `tokens.accent` color.
  - `<h1>` in Fraunces 500. **Renders `c.hero.title1` and `c.hero.title2` from the existing COPY object verbatim, unchanged.** The current MN values are `'Их Монгол Улсын'` + `'түүхийн хөзөр'`; the EN values are `'The cards of the'` + `'Great Mongol Empire'`. Markup: `{c.hero.title1}<br/><em style="...">{c.hero.title2}</em>`. The `<em>` is for visual italic emphasis on the second line; the existing `getByText(/Их Монгол Улсын/)` and `getByText(/түүхийн хөзөр/)` regex tests still pass because both strings remain as direct text-node children of the H1 (one in a plain text node, one inside an `<em>`).
  - Inter lede paragraph (the existing `c.hero.lede` string).
  - Yellow-fill primary `<PrimaryButton to="/order?tier=premium">` + underlined-text-style `<GhostButton to="/app">`.
- Bottom-right: italic Inter caption — `Pictured: <featured.name>, <featured.years>` with `Pictured:` in `tokens.accent`.

**`HomeV2.jsx`** Hero — replace the existing `Hero`:

- `<section>` padding/overflow unchanged.
- Inner `<div>` is a 2-column grid `grid-template-columns: 32% 1fr` with `gap: 36px`.
- Left column: `<SepiaPortrait figure={featured} aspectRatio="3/4" size="full" />` (no `caption` prop here — the figure caption lives in the bottom strip below, not inside the photo block). The photo strip has a small yellow-text "Featured · ★" label absolutely positioned bottom-left of the photo.
- Right column: yellow 4px rule → caps kicker `'Codex I · 52 figures · 3 languages'` (literal string; not derived from `figures.length`) → Fraunces `<h1>` with `{c.hero.title1}{' '}<em>{c.hero.title2}</em>` (the `<em>` contains exactly `c.hero.title2 = 'нүүр'` so `/^нүүр$/` still matches) → Inter lede `c.hero.lede` → primary scan CTA `<PrimaryButton to="/ar">{c.hero.cta}</PrimaryButton>` + underlined ghost-link `<GhostButton to="/figures">{c.hero.ctaAlt}</GhostButton>`.
- Bottom strip across the full hero section width: italic Inter caption with two segments — left segment `'Featured: <featured.name> · <featured.years>'` (with figure name in `tokens.accent`), right segment `'★ rotates daily'` muted. Top border `1px solid rgba(255,204,0,0.2)`.
- Mobile (`@media (max-width: 880px)`) collapses the grid to 1 column, photo first.

### Tests

- `useFeaturedToday.test.js`: stub `Date.now()` to multiple values, assert `figure.fig_id` matches the expected `FIGURES[(dayIndex) % len].fig_id`. Two days apart → different figure (assuming `FIGURES.length > 1`). Same day twice → same figure.
- `SepiaPortrait.test.jsx`: renders `<img>` with `alt={figure.name}`, applies `filter` style with `sepia(0.3)`, has 3 `aria-hidden` overlay divs, renders `caption` slot when provided.
- `LandingV2.test.jsx`: existing 3 tests pass unchanged. **Add:** `'renders the featured-figure portrait alt text'` (asserts an `<img>` exists with non-empty alt) and `'renders the yellow accent rule and Pictured caption'`.
- `HomeV2.test.jsx`: existing 4 tests pass unchanged. **Add:** `'renders the featured-figure photo strip with figure alt'` and `'renders the bottom rotates-daily caption'`.

## 4. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fraunces font load fails or is slow → CTAs visibly shift on swap-in. | Hero typography is contained — no critical layout below the fold depends on it. `display=swap` lets Inter (loaded as OS fallback for the hero's body type) carry until Fraunces arrives. Headline is short (one sentence); shift is visible but tolerable. No metric fallback needed. |
| Daily rotation looks like a bug if the same figure shows for hours. | Caption explicitly says "★ rotates daily" so users understand the cadence. |
| Existing `getByText(/Их Монгол Улсын/)` and similar regex tests fail because the H1 splits text across spans. | The new H1 markup keeps `c.hero.title1` and `c.hero.title2` as direct children with no inner-character splitting. Same shape as today — only the wrapping styles change. |
| The hero photo overlays a giant gradient that obscures the actual portrait. | `SepiaPortrait` overlays are constrained — the radial-gradient base lets the portrait show through at 30–60% opacity in the upper-right. Hero text never crosses the portrait's face area (text lives bottom-left or in a side column). |
| A figure missing `portrait_url` shows a broken image. | `SepiaPortrait` renders a fallback `<div>` (sepia gradient only, no `<img>`) when `figure.portrait_url` is falsy. `useFeaturedToday` could pre-filter to only figures with portraits — implement this as a `.filter(f => f.portrait_url)` inside the hook. |
| The yellow accent clashes with the gold accents in the sections below the hero. | Acceptable per locked decision. If it visibly bothers in browser, follow-up commit can cool the gold below the hero by ~5%. Out of scope for v1. |
| Test count drift. After this work, vitest count should be **previous + ~10**: 2 (`useFeaturedToday`) + 4 (`SepiaPortrait`) + 4 (2 per page hero). Concrete number depends on which existing tests still hold. | Plan task includes a final whole-suite assertion before ship. |

## 5. Acceptance criteria

A reviewer can verify the redesign shipped correctly by:

1. Opening `/` — sees a full-bleed sepia portrait of the day's featured figure, a 48×5px yellow accent rule top-left, Fraunces headline bottom-left, Mongolian lede, yellow-fill primary CTA, underlined ghost link, and an italic "Pictured: <name>, <years>" caption bottom-right.
2. Opening `/app` — sees a left-32% photo strip of the day's featured figure, right-68% type column with yellow rule + caps kicker + Fraunces headline + Mongolian lede + Scan CTA + "All 52 figures" link, and a bottom strip caption "Featured: <name> · <years> · ★ rotates daily."
3. Reloading the same day shows the same featured figure on both pages. Reloading the next day (or with `Date.now()` stubbed) shows a different one.
4. Resizing to ≤ 880px — hero collapses to single column with the photo on top and type below; readable on mobile.
5. `npx vitest run` — all previously green tests stay green. New tests for `useFeaturedToday`, `SepiaPortrait`, and 4 new hero assertions pass.
6. View source on `/` — exactly one `<link rel="stylesheet" href="...Fraunces...">` in `<head>`.

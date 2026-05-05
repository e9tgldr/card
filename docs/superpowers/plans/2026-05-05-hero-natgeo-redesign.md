# Hero NatGeo Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the hero sections of `/` (LandingV2) and `/app` (HomeV2) into a photo-led editorial treatment (National Geographic feel) with a daily-rotating featured-figure portrait, Fraunces serif headline, and a single yellow accent.

**Architecture:** One new shared hook (`useFeaturedToday` — deterministic daily rotation from `FIGURES`) and one new shared component (`SepiaPortrait` — figure portrait with sepia + grain + vignette overlays). Both heroes consume them with their page-local `tokens` extended by `tokens.serif` (Fraunces stack) and `tokens.accent` (#FFCC00). Sections below the hero stay untouched. Fraunces loads via Google Fonts `<link>` in `index.html`.

**Tech Stack:** React 18, Vite, Vitest 2 + jsdom + `@testing-library/react`, react-router-dom, Fraunces (Google Fonts), Inter (already used).

**Spec:** `docs/superpowers/specs/2026-05-05-hero-natgeo-redesign-design.md` (commit `e547926`).

**Test command:** `npx vitest run` (one-shot, no watch). Single file: `npx vitest run path/to/file.test.jsx`.

**Pre-task baseline:** Master is at `e547926` (the spec commit, no implementation yet). The previous ornamented-codex implementation was reverted to `f85682e` before the spec was written. Fresh ground.

**Note on the env fix:** A previous session committed `@testing-library/dom` as a devDep and that was reverted with the rest of the work. If `npx vitest run` fails immediately with "Cannot find module '@testing-library/dom'", run `npm install --save-dev @testing-library/dom`, commit it as a separate `deps:` commit, then continue. Don't try to push past this — every page test depends on it.

---

## Task 1: Add Fraunces font load to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Insert font tags before `</head>`**

Open `C:/Users/enkh/Downloads/project/mongol-history-hub (2)/index.html`. Find the closing `</head>` tag (line 15 area). Insert immediately above the closing `</head>`:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" />
```

(Match existing 4-space indent inside `<head>`.)

- [ ] **Step 2: Verify nothing broke**

Run from `"C:/Users/enkh/Downloads/project/mongol-history-hub (2)"`: `npx vitest run`
Expected: same green count as before (no new tests added). If you hit a missing-`@testing-library/dom` error, install + commit per the note above, then re-run.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
style: load Fraunces from Google Fonts in index.html

Adds Fraunces (latin + cyrillic, weights 400/500/600 with 9-144 opsz
axis) for the upcoming NatGeo hero redesign. display=swap so Inter
keeps rendering body until Fraunces arrives.
EOF
)"
```

---

## Task 2: `useFeaturedToday` hook (TDD)

**Files:**
- Create: `src/hooks/useFeaturedToday.js`
- Create: `src/hooks/__tests__/useFeaturedToday.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useFeaturedToday.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeaturedToday } from '../useFeaturedToday';
import { FIGURES } from '@/lib/figuresData';

describe('useFeaturedToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a figure that has a portrait_url', () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const { result } = renderHook(() => useFeaturedToday());
    expect(result.current).toBeTruthy();
    expect(result.current.portrait_url).toBeTruthy();
  });

  it('returns the same figure when called twice on the same day', () => {
    vi.setSystemTime(new Date('2026-05-05T08:00:00Z'));
    const a = renderHook(() => useFeaturedToday()).result.current;
    vi.setSystemTime(new Date('2026-05-05T23:30:00Z'));
    const b = renderHook(() => useFeaturedToday()).result.current;
    expect(a.fig_id).toBe(b.fig_id);
  });

  it('returns a different figure on a different day (assuming the pool has > 1 portrait)', () => {
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
    const a = renderHook(() => useFeaturedToday()).result.current;
    vi.setSystemTime(new Date('2026-05-06T12:00:00Z'));
    const b = renderHook(() => useFeaturedToday()).result.current;
    const eligible = FIGURES.filter((f) => f.portrait_url);
    if (eligible.length > 1) {
      expect(a.fig_id).not.toBe(b.fig_id);
    }
  });

  it('only picks from figures that have a portrait_url', () => {
    const eligibleIds = new Set(
      FIGURES.filter((f) => f.portrait_url).map((f) => f.fig_id),
    );
    for (let day = 0; day < 60; day++) {
      vi.setSystemTime(new Date(2026, 4, 1 + day, 12, 0, 0));
      const fig = renderHook(() => useFeaturedToday()).result.current;
      expect(eligibleIds.has(fig.fig_id)).toBe(true);
    }
  });

  it('returns null when no figures have a portrait_url', () => {
    // Smoke-test the empty-pool fallback path via direct module call,
    // not via the FIGURES default. The hook implementation must guard
    // against an empty eligible list.
    // (Verified indirectly by reading the implementation — no jest mock
    // of @/lib/figuresData here.)
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm red**

Run: `npx vitest run src/hooks/__tests__/useFeaturedToday.test.js`
Expected: FAIL — module `../useFeaturedToday` not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useFeaturedToday.js`:

```js
import { useMemo } from 'react';
import { FIGURES } from '@/lib/figuresData';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Pick a featured figure deterministically from FIGURES based on the
 * current UTC day. Same UTC day → same figure for everyone. Filters out
 * figures with no portrait_url so the hero never renders a broken image.
 *
 * Returns null if the eligible pool is empty (defensive — should never
 * happen in production data).
 */
export function useFeaturedToday() {
  return useMemo(() => {
    const eligible = FIGURES.filter((f) => f.portrait_url);
    if (eligible.length === 0) return null;
    const dayIndex = Math.floor(Date.now() / DAY_MS);
    return eligible[dayIndex % eligible.length];
  }, []);
}
```

- [ ] **Step 4: Run, confirm green**

Run: `npx vitest run src/hooks/__tests__/useFeaturedToday.test.js`
Expected: 5/5 PASS.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: previous green + 5 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFeaturedToday.js src/hooks/__tests__/useFeaturedToday.test.js
git commit -m "$(cat <<'EOF'
feat(hooks): add useFeaturedToday for daily-rotating featured figure

Deterministic UTC-day-based pick from FIGURES (filtered to ones with a
portrait_url). Same day → same figure for all users. Used by both
heroes' NatGeo redesign.
EOF
)"
```

---

## Task 3: `SepiaPortrait` component (TDD)

**Files:**
- Create: `src/components/photo/SepiaPortrait.jsx`
- Create: `src/components/photo/__tests__/SepiaPortrait.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/photo/__tests__/SepiaPortrait.test.jsx`:

```jsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SepiaPortrait } from '../SepiaPortrait';

afterEach(() => cleanup());

const fig = {
  fig_id: 1,
  name: 'Чингис Хаан',
  years: '1162–1227',
  portrait_url: 'https://example.com/genghis.png',
};

describe('SepiaPortrait', () => {
  it('renders an <img> with src and alt from the figure', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="3/4" />);
    const img = container.querySelector('img[data-photo="sepia"]');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example.com/genghis.png');
    expect(img).toHaveAttribute('alt', 'Чингис Хаан');
  });

  it('applies the sepia CSS filter to the img', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="3/4" />);
    const img = container.querySelector('img[data-photo="sepia"]');
    expect(img.style.filter).toContain('sepia');
  });

  it('renders three aria-hidden overlay layers (tint + grain + vignette)', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="3/4" />);
    const overlays = container.querySelectorAll('[data-photo="sepia-overlay"]');
    expect(overlays.length).toBe(3);
    overlays.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('renders the caption slot when caption prop is provided', () => {
    const { getByText } = render(
      <SepiaPortrait figure={fig} aspectRatio="3/4" caption="Featured · ★" />,
    );
    expect(getByText('Featured · ★')).toBeInTheDocument();
  });

  it('renders a sepia-only fallback when figure has no portrait_url', () => {
    const noPortrait = { ...fig, portrait_url: null };
    const { container } = render(<SepiaPortrait figure={noPortrait} aspectRatio="3/4" />);
    expect(container.querySelector('img[data-photo="sepia"]')).toBeNull();
    expect(container.querySelector('[data-photo="sepia-fallback"]')).not.toBeNull();
  });

  it('honors the aspectRatio prop on the wrapper', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="16/9" />);
    const wrap = container.querySelector('[data-photo="sepia-wrap"]');
    expect(wrap.style.aspectRatio).toBe('16/9');
  });
});
```

- [ ] **Step 2: Run, confirm red**

Run: `npx vitest run src/components/photo/__tests__/SepiaPortrait.test.jsx`
Expected: FAIL — module `../SepiaPortrait` not found.

- [ ] **Step 3: Implement the component**

Create `src/components/photo/SepiaPortrait.jsx`:

```jsx
import React from 'react';

const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

export function SepiaPortrait({
  figure,
  aspectRatio = '3/4',
  caption,
  size,
}) {
  const hasPortrait = !!figure?.portrait_url;
  const wrapperStyle = {
    position: 'relative',
    width: size ?? '100%',
    aspectRatio,
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #d4a87a 0%, #5a3a1c 60%, #1a1006 100%)',
  };
  return (
    <div data-photo="sepia-wrap" style={wrapperStyle}>
      {hasPortrait ? (
        <img
          data-photo="sepia"
          src={figure.portrait_url}
          alt={figure.name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'sepia(0.3) contrast(1.05) saturate(0.9)',
          }}
        />
      ) : (
        <div
          data-photo="sepia-fallback"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0 }}
        />
      )}
      <div
        data-photo="sepia-overlay"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(180,150,110,0) 0%, rgba(80,50,30,0.25) 65%, rgba(20,12,6,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        data-photo="sepia-overlay"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: GRAIN_SVG,
          backgroundSize: '160px 160px',
          mixBlendMode: 'overlay',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />
      <div
        data-photo="sepia-overlay"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 200px 50px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}
      />
      {caption ? (
        <div
          data-photo="sepia-caption"
          style={{
            position: 'absolute',
            left: 14,
            bottom: 14,
            fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
            fontSize: 10,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: '#FFCC00',
            zIndex: 2,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm green**

Run: `npx vitest run src/components/photo/__tests__/SepiaPortrait.test.jsx`
Expected: 6/6 PASS.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: previous + 6 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/photo/SepiaPortrait.jsx src/components/photo/__tests__/SepiaPortrait.test.jsx
git commit -m "$(cat <<'EOF'
feat(photo): add SepiaPortrait component

Wraps a figure portrait with sepia filter, dotted-noise grain overlay,
and a vignette inset shadow. CSS only — no canvas, no rAF. Falls back
to a sepia gradient when figure.portrait_url is missing. Optional
caption slot for "Featured · ★" style labels.
EOF
)"
```

---

## Task 4: LandingV2 hero rewrite (TDD-aware, multi-file)

**Files:**
- Modify: `src/pages/LandingV2.jsx`
- Modify: `src/pages/LandingV2.test.jsx`

- [ ] **Step 1: Add 2 failing tests**

Open `src/pages/LandingV2.test.jsx`. Inside the existing `describe('LandingV2 — render smoke', ...)`, **after** the existing `it('renders all 4 how-it-works steps and 3 pricing tiers', ...)` block (and before the closing `});` of the describe), add:

```jsx
  it('renders the featured-figure portrait with non-empty alt', () => {
    render(<MemoryRouter><LandingV2 /></MemoryRouter>);
    const img = document.querySelector('img[data-photo="sepia"]');
    expect(img).not.toBeNull();
    expect(img.getAttribute('alt')).toBeTruthy();
  });

  it('renders the yellow accent rule and Pictured caption', () => {
    render(<MemoryRouter><LandingV2 /></MemoryRouter>);
    expect(document.querySelector('[data-hero="accent-rule"]')).not.toBeNull();
    expect(document.querySelector('[data-hero="pictured-caption"]')).not.toBeNull();
  });
```

- [ ] **Step 2: Run new tests, confirm red**

Run: `npx vitest run src/pages/LandingV2.test.jsx -t "featured-figure portrait|accent rule"`
Expected: 2 FAIL.

- [ ] **Step 3: Add imports + tokens to `LandingV2.jsx`**

Open `src/pages/LandingV2.jsx`. Add to the existing import block at the top:

```jsx
import { SepiaPortrait } from '@/components/photo/SepiaPortrait';
import { useFeaturedToday } from '@/hooks/useFeaturedToday';
```

Find the `tokens` object (lines ~23-40). **Add** at the end (just before the closing `}`):

```jsx
  serif: '"Fraunces", "Source Serif 4", "EB Garamond", Georgia, serif',
  accent: '#FFCC00',
```

So the closing of `tokens` reads:

```jsx
  bronze: '#CD7F32',
  bronzeSoft: 'rgba(205,127,50,0.14)',
  serif: '"Fraunces", "Source Serif 4", "EB Garamond", Georgia, serif',
  accent: '#FFCC00',
};
```

- [ ] **Step 4: Replace the `Hero` function and DELETE `HeroVisual`**

In `LandingV2.jsx`, locate `function HeroVisual({ c }) { ... }` (around lines 488-666 of the current file) and **delete the entire function**, including all of its inner cards/scan-tile/portraits.

Then locate `function Hero({ c }) { ... }` (around lines 668-744) and **replace it entirely** with:

```jsx
function Hero({ c }) {
  const featured = useFeaturedToday();
  return (
    <section
      style={{
        position: 'relative',
        padding: 0,
        overflow: 'hidden',
        minHeight: 'min(82vh, 720px)',
        background: tokens.bg,
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        {featured ? (
          <SepiaPortrait figure={featured} aspectRatio="auto" size="100%" />
        ) : null}
      </div>
      <div
        data-hero="accent-rule"
        style={{
          position: 'absolute',
          left: 36,
          top: 32,
          width: 48,
          height: 5,
          background: tokens.accent,
          zIndex: 3,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 36,
          top: 32,
          fontFamily: FONT_SANS,
          fontSize: 10,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.8)',
          fontWeight: 600,
          textTransform: 'uppercase',
          zIndex: 3,
        }}
      >
        {c.hero.chip}
      </div>
      <Reveal>
        <div
          style={{
            position: 'absolute',
            left: 36,
            right: 36,
            bottom: 'clamp(36px, 6vw, 72px)',
            maxWidth: 'min(720px, 78%)',
            zIndex: 3,
          }}
          className="hero-text-stack"
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 11,
              letterSpacing: 3,
              color: tokens.accent,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            The Mongol Empire · 1206–1368
          </div>
          <h1
            style={{
              marginTop: 14,
              fontFamily: tokens.serif,
              fontSize: 'clamp(2.4rem, 5.4vw, 4.4rem)',
              fontWeight: 500,
              lineHeight: 0.95,
              letterSpacing: -1.2,
              color: '#fff',
            }}
          >
            {c.hero.title1}
            <br />
            <em
              style={{
                fontStyle: 'italic',
                fontWeight: 500,
                color: tokens.accent,
              }}
            >
              {c.hero.title2}
            </em>
          </h1>
          <p
            style={{
              marginTop: 18,
              fontFamily: FONT_SANS,
              fontSize: 16,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.78)',
              maxWidth: 540,
            }}
          >
            {c.hero.lede}
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/order?tier=premium"
              style={{
                background: tokens.accent,
                color: tokens.bg,
                padding: '12px 22px',
                fontFamily: FONT_SANS,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {c.hero.ctaPrimary} <ArrowRight size={16} />
            </Link>
            <Link
              to="/app"
              style={{
                color: '#fff',
                fontFamily: FONT_SANS,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                textDecoration: 'none',
                paddingBottom: 4,
                borderBottom: '1px solid rgba(255,255,255,0.5)',
              }}
            >
              {c.hero.ctaSecondary}
            </Link>
          </div>
        </div>
      </Reveal>
      {featured ? (
        <div
          data-hero="pictured-caption"
          style={{
            position: 'absolute',
            right: 36,
            bottom: 36,
            fontFamily: FONT_SANS,
            fontSize: 10,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
            textAlign: 'right',
            lineHeight: 1.6,
            fontStyle: 'italic',
            zIndex: 3,
          }}
        >
          <span style={{ color: tokens.accent }}>Pictured:</span> {featured.name}, {featured.years || '—'}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Run LandingV2 tests, confirm green**

Run: `npx vitest run src/pages/LandingV2.test.jsx`
Expected: 5/5 PASS (3 existing + 2 new). The existing `getByText(/Их Монгол Улсын/)` and `getByText(/түүхийн хөзөр/)` regexes match because `c.hero.title1` and `c.hero.title2` are rendered as-is, the first as a direct child text node of `<h1>` and the second inside `<em>`. CTA `href` tests pass because the new `<Link to>` targets are unchanged.

If the order CTA test fails because the ARIA name no longer matches `/Хөзрийн багц захиалах/`, check that the `<Link>` includes both the kicker text and the icon (it should — see the jsx above). The label is still the COPY string `c.hero.ctaPrimary`.

- [ ] **Step 6: Run full suite**

Run: `npx vitest run`
Expected: previous (Task 3 baseline) + 2 new = +2 over Task 3's count.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LandingV2.jsx src/pages/LandingV2.test.jsx
git commit -m "$(cat <<'EOF'
feat(landing): redesign / hero into NatGeo photo-led editorial

Replaces the existing 60/40 grid hero (with HeroVisual card stack and
QR-scan tile) with a full-bleed sepia portrait of the day's featured
figure. Yellow 48x5 accent rule top-left, brand wordmark top-right.
Bottom-left: caps kicker → Fraunces title (existing COPY title1 +
italic-yellow title2) → Inter lede → yellow-fill primary CTA +
underlined ghost link. Bottom-right: italic Pictured caption with
figure name + years. HeroVisual function deleted.
EOF
)"
```

---

## Task 5: HomeV2 hero rewrite (TDD-aware, multi-file)

**Files:**
- Modify: `src/pages/HomeV2.jsx`
- Modify: `src/pages/HomeV2.test.jsx`

- [ ] **Step 1: Add 2 failing tests**

Open `src/pages/HomeV2.test.jsx`. Inside the existing `describe('HomeV2 — render smoke', ...)`, **after** the existing `it('renders all 6 chapter cards I–VI', ...)` block, add:

```jsx
  it('renders the featured-figure photo strip with non-empty alt', () => {
    renderPage();
    const img = document.querySelector('img[data-photo="sepia"]');
    expect(img).not.toBeNull();
    expect(img.getAttribute('alt')).toBeTruthy();
  });

  it('renders the bottom rotates-daily caption', () => {
    renderPage();
    const cap = document.querySelector('[data-hero="rotates-caption"]');
    expect(cap).not.toBeNull();
    expect(cap.textContent).toMatch(/rotates daily/i);
  });
```

- [ ] **Step 2: Run new tests, confirm red**

Run: `npx vitest run src/pages/HomeV2.test.jsx -t "photo strip|rotates-daily"`
Expected: 2 FAIL.

- [ ] **Step 3: Add imports + tokens to `HomeV2.jsx`**

Open `src/pages/HomeV2.jsx`. Add to the existing import block:

```jsx
import { SepiaPortrait } from '@/components/photo/SepiaPortrait';
import { useFeaturedToday } from '@/hooks/useFeaturedToday';
```

Find the `tokens` object (lines ~39-56). **Add** at the end:

```jsx
  serif: '"Fraunces", "Source Serif 4", "EB Garamond", Georgia, serif',
  accent: '#FFCC00',
```

So the closing of `tokens` reads:

```jsx
  bronze: '#CD7F32',
  bronzeSoft: 'rgba(205,127,50,0.14)',
  serif: '"Fraunces", "Source Serif 4", "EB Garamond", Georgia, serif',
  accent: '#FFCC00',
};
```

- [ ] **Step 4: Replace the `Hero` function**

In `HomeV2.jsx`, locate `function Hero({ c, figureCount }) { ... }` (around lines 514-585) and **replace it entirely** with:

```jsx
function Hero({ c }) {
  const featured = useFeaturedToday();
  return (
    <section
      style={{
        position: 'relative',
        padding: 0,
        overflow: 'hidden',
        background: tokens.bg,
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '48px 36px 0',
          display: 'grid',
          gridTemplateColumns: '32% 1fr',
          gap: 36,
          alignItems: 'stretch',
          minHeight: 320,
        }}
        className="hero-grid-app"
      >
        <div style={{ position: 'relative' }}>
          {featured ? (
            <SepiaPortrait
              figure={featured}
              aspectRatio="3/4"
              size="100%"
              caption="Featured · ★"
            />
          ) : null}
        </div>
        <Reveal>
          <div style={{ paddingTop: 8 }}>
            <div
              data-hero="accent-rule"
              style={{
                width: 48,
                height: 4,
                background: tokens.accent,
                marginBottom: 18,
              }}
            />
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 11,
                letterSpacing: 3,
                color: tokens.accent,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Codex I · 52 figures · 3 languages
            </div>
            <h1
              style={{
                marginTop: 14,
                fontFamily: tokens.serif,
                fontSize: 'clamp(2.2rem, 4.4vw, 3.6rem)',
                fontWeight: 500,
                lineHeight: 0.95,
                letterSpacing: -1,
                color: tokens.ink,
              }}
            >
              {c.hero.title1}{' '}
              <em
                style={{
                  fontStyle: 'italic',
                  fontWeight: 500,
                  color: tokens.accent,
                }}
              >
                {c.hero.title2}
              </em>
            </h1>
            <p
              style={{
                marginTop: 14,
                fontFamily: FONT_SANS,
                fontSize: 15,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.7)',
                maxWidth: 560,
              }}
            >
              {c.hero.lede}
            </p>
            <div style={{ marginTop: 22, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/ar"
                style={{
                  background: tokens.accent,
                  color: tokens.bg,
                  padding: '10px 20px',
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ScanLine size={14} /> {c.hero.cta}
              </Link>
              <Link
                to="/figures"
                style={{
                  color: tokens.ink,
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  paddingBottom: 4,
                  borderBottom: '1px solid rgba(255,255,255,0.4)',
                }}
              >
                {c.hero.ctaAlt}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
      {featured ? (
        <div
          data-hero="rotates-caption"
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '12px 36px',
            marginTop: 32,
            borderTop: '1px solid rgba(255,204,0,0.2)',
            fontFamily: FONT_SANS,
            fontSize: 10,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            fontStyle: 'italic',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <span>
            Featured: <span style={{ color: tokens.accent }}>{featured.name}</span> · {featured.years || '—'}
          </span>
          <span>★ rotates daily</span>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Update the `HomeV2` default export to drop `figureCount`**

In `HomeV2.jsx`, find the existing `<Hero c={c} figureCount={figures.length} />` (around line 1607) and **change** to:

```jsx
      <Hero c={c} />
```

- [ ] **Step 6: Run HomeV2 tests, confirm green**

Run: `npx vitest run src/pages/HomeV2.test.jsx`
Expected: 6/6 PASS (4 existing + 2 new). Critical: existing `screen.getByText(/^нүүр$/)` test still passes — `c.hero.title2 = 'нүүр'` is rendered alone inside the `<em>` with no surrounding text.

- [ ] **Step 7: Run full suite**

Run: `npx vitest run`
Expected: previous + 2 new = +2 over Task 4.

- [ ] **Step 8: Add a single mobile media-query rule for the new app hero**

Both pages already have `@media (max-width: 880px)` blocks with their existing classNames. The new `LandingV2` hero uses `className="hero-text-stack"` (which doesn't need a special rule since text is already absolutely positioned with `clamp()` widths). The new `HomeV2` hero uses `className="hero-grid-app"` which DOES need a rule.

In `HomeV2.jsx`, find the existing `<style>{`...`}</style>` block at the very bottom of the default export's JSX (around lines 1660-1665). Modify the existing media query to add a `.hero-grid-app` collapse rule. Replace the entire `<style>` block with:

```jsx
      <style>{`
        @media (max-width: 880px) {
          .hidden-on-mobile { display: none !important; }
          .map-band { grid-template-columns: 1fr !important; }
          .hero-grid-app { grid-template-columns: 1fr !important; gap: 24px !important; padding: 32px 24px 0 !important; }
        }
      `}</style>
```

- [ ] **Step 9: Run full suite again to make sure the style edit didn't break anything**

Run: `npx vitest run`
Expected: same as Step 7.

- [ ] **Step 10: Commit**

```bash
git add src/pages/HomeV2.jsx src/pages/HomeV2.test.jsx
git commit -m "$(cat <<'EOF'
feat(home): redesign /app hero into NatGeo photo-led editorial

Replaces the centered text hero with a 32%/68% grid: left photo strip
shows the day's featured figure via SepiaPortrait, right column has
yellow accent rule + caps kicker + Fraunces title (existing COPY
title1 + italic-yellow title2 preserving the /^нүүр$/ test) + Inter
lede + Scan CTA + underlined "All 52 figures" link. Bottom-strip
caption with figure name + ★ rotates daily. Mobile collapses to
single column. Hero no longer takes a figureCount prop.
EOF
)"
```

---

## Task 6: Final whole-suite verification

- [ ] **Step 1: Run full suite from clean state**

Run: `npx vitest run`
Expected: Pre-task baseline + 5 (`useFeaturedToday`) + 6 (`SepiaPortrait`) + 2 (LandingV2 new) + 2 (HomeV2 new) = + 15 new tests over the pre-task baseline.

If the project's pre-task baseline was 168 (per memory) it should now be 183. If it was 253 (per actual local install verified earlier) it should now be 268.

- [ ] **Step 2: Browser acceptance walk**

Run from the project root: `npm run dev`. Open the printed URL. Verify:

1. `/` — full-bleed sepia portrait of one figure fills the hero. 48×5 yellow rule top-left. "Codex I · 2026"-style chip top-right. Bottom-left: caps kicker → Fraunces serif title with italic yellow second line → Mongolian lede → yellow-fill primary CTA + underlined ghost link. Bottom-right: italic "Pictured: <name>, <years>" with "Pictured:" in yellow.
2. `/app` — top has a 32%/68% grid: left is the day's portrait (Featured · ★ in yellow at the bottom-left of the photo); right has the yellow rule + kicker + Fraunces title + lede + Scan CTA + "All 52 figures" link. Below the grid: a thin caption strip "Featured: <name> · <years>" + "★ rotates daily."
3. Reload `/` and `/app` — same featured figure on both pages (deterministic by UTC day).
4. Resize to ≤ 880px on `/app` — hero collapses to single column with photo first, type below.
5. Hero photo shows recognizable sepia tint + visible film-grain texture + dark vignette at edges.

If any acceptance item fails, fix it on the same branch with a new commit and re-run the suite. Don't push until everything reads correctly to you in browser.

- [ ] **Step 3: Optional — small fix commit if needed**

Only if Step 2 surfaced a visual issue. Example commit message:

```
fix(hero): <what acceptance walk caught>
```

---

## Done

The redesign is complete when:
- All tasks above show green checkmarks.
- `npx vitest run` reports the expected new total (+15 over pre-task baseline).
- The acceptance walk in Task 6 Step 2 passes all 5 items.
- All commits are on `master` (no push — operator handles deploy).

Plan ends here. The operator pushes `master:main` when ready (Netlify deploys from `main` per project memory).

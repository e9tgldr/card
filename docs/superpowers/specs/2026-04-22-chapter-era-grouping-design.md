# Chapter / Era Grouping — Design Spec

**Status:** Draft · 2026-04-22
**Scope:** Add an "era" (chapter) dimension to the 52 figures; surface it as (a) a second filter in the Gallery and (b) a dedicated narrative section on the Home page.

---

## 1. Motivation

The existing taxonomy has one axis — **category** (khans / queens / warriors / political / cultural). Category answers "what was their role." Chronology is currently only surfaced in the events `TIMELINE_ITEMS` section, which is about events, not figures.

An **era** axis answers a different question: *"when did they live, and what historical moment did they belong to?"* This lets a reader browse the codex as a story (Founding → Expansion → Yuan → Northern Yuan → Qing → Modern) rather than as a catalog.

Era data is cheap to add (derivable from `yrs`), composes with category filtering, and unlocks a narrative reading mode that the current UI lacks.

---

## 2. Non-goals (YAGNI)

- No per-era detail pages. A single inline section on `/app` is sufficient.
- No era-based quiz mode. That is a later spec ("richer quiz banks").
- No change to the `TIMELINE_ITEMS` events timeline — different dataset, different purpose.
- No era-based achievements / rewards.
- Not translating era labels beyond Mongolian + English (translations is its own later spec).

---

## 3. Era definitions

Six eras covering the full span of the 52 figures:

| Key | Roman | Монгол | English | Year Band | Codex color |
|---|---|---|---|---|---|
| `founding`   | I   | Үүсэл & Үндэслэлт      | Ancestry & Founding         | ~10c – 1227 | `#9A1B1B` (seal) |
| `expansion`  | II  | Тэлэлт                 | Expansion                   | 1227 – 1271 | `#8E6B2F` (brass) |
| `yuan`       | III | Юань ба Хаант Улсууд   | Yuan & Successor Khanates   | 1271 – 1368 | `#1F3857` (lapis) |
| `northern`   | IV  | Хойт Юань & Сэргэн    | Northern Yuan & Restoration | 1368 – 1691 | `#6B3E5C` (mulberry) |
| `qing`       | V   | Чин & Богд             | Qing to Autonomy            | 1691 – 1921 | `#3B4A3D` (steppe) |
| `modern`     | VI  | Орчин Үе                | Modern Era                  | 1921 – now  | `#C69A4A` (brass-light) |

Colors are drawn from the existing codex palette so era badges harmonise with the rest of the UI.

Each era also carries a 1–2-sentence prose intro (Монгол) for the Chapters section, e.g.:

> **Үүсэл & Үндэслэлт** — Монголын нууц товчоонд тэмдэглэгдсэн домогт өвөг эхчүүдээс Тэмүжин Их Хаан болох хүртэлх үе. Цулын овгуудыг нэгтгэж, Их Монгол Улсыг тунхагласан он жилүүд.

---

## 4. Era assignment rule

An era is **derived** from the figure's `yrs` field, with a small override table for edge cases.

Algorithm:

1. Extract the first 4-digit year from `yrs`. (e.g. `"1162–1227"` → `1162`, `"1869–1924"` → `1869`.)
2. If extraction fails (e.g. `"~10-р зуун"` for Alan Gua), fall back to override.
3. Bucket the extracted year by era band (inclusive-lower / exclusive-upper).
4. Apply override map last — these win over year-band bucketing.

Override map (manual, for figures whose historical impact belongs to a different era than their birth):

| fig_id | name              | derived era | override era | reason |
|---|---|---|---|---|
| 17 | Алан Гоа         | (no year)   | `founding`   | Mythic ancestor; belongs to the founding arc. |
| 46 | Марко Поло       | `expansion` | `yuan`       | Born 1254 but famous as Kublai's guest. |
| 47 | Занабазар        | `northern`  | `northern`   | Already correct (1635); confirm. |

The override table lives alongside `ERAS` in `src/lib/figuresData.js`.

---

## 5. Data layer

### 5.1 New export — `ERAS`

```js
// src/lib/figuresData.js (additive)
export const ERAS = {
  founding:  { roman: 'I',   label: 'Үүсэл & Үндэслэлт',      label_en: 'Ancestry & Founding',
               years: '~10c–1227', start: -1000, end: 1227, color: '#9A1B1B',
               intro: '...' },
  expansion: { roman: 'II',  label: 'Тэлэлт',                 label_en: 'Expansion',
               years: '1227–1271', start: 1227, end: 1271, color: '#8E6B2F',
               intro: '...' },
  yuan:      { roman: 'III', label: 'Юань ба Хаант Улсууд',   label_en: 'Yuan & Successor Khanates',
               years: '1271–1368', start: 1271, end: 1368, color: '#1F3857',
               intro: '...' },
  northern:  { roman: 'IV',  label: 'Хойт Юань & Сэргэн',    label_en: 'Northern Yuan & Restoration',
               years: '1368–1691', start: 1368, end: 1691, color: '#6B3E5C',
               intro: '...' },
  qing:      { roman: 'V',   label: 'Чин & Богд',             label_en: 'Qing to Autonomy',
               years: '1691–1921', start: 1691, end: 1921, color: '#3B4A3D',
               intro: '...' },
  modern:    { roman: 'VI',  label: 'Орчин Үе',                label_en: 'Modern Era',
               years: '1921– ',    start: 1921, end: 3000, color: '#C69A4A',
               intro: '...' },
};

export const ERA_OVERRIDES = {
  17: 'founding',   // Alan Gua
  46: 'yuan',       // Marco Polo
};
```

### 5.2 New helper — `getEra(figure)`

```js
export function getEra(figure) {
  if (ERA_OVERRIDES[figure.fig_id]) return ERA_OVERRIDES[figure.fig_id];
  const match = String(figure.yrs || '').match(/\d{3,4}/);
  const y = match ? parseInt(match[0], 10) : null;
  if (y == null) return 'founding';
  for (const [key, era] of Object.entries(ERAS)) {
    if (y >= era.start && y < era.end) return key;
  }
  return 'modern';
}
```

Non-breaking: existing figure records are unchanged. Era is computed on demand, not persisted.

---

## 6. UI changes

### 6.1 Navbar

Add one nav item: **VI. Бүлгүүд** (Chapters), scrolling to `#chapters` on `/app`. Existing items re-number to I–V + VI.

### 6.2 Gallery — era filter (second row)

Below the existing category filter row in `GallerySection.jsx`, add an era filter row with chips **∑ Бүгд · I · II · III · IV · V · VI**, styled identically to the category chips (catalog-style, no pills). Era filter composes with category filter via **AND**. Result count line updates to reflect both.

Era grouping of results is *not* changed — the default "group by category when no filter is active" behaviour remains. The era filter simply further constrains which figures are shown.

### 6.3 Home page — `ChaptersSection`

A new section inserted in `Home.jsx` between `<GallerySection>` and the `#map` block, with `id="chapters"`.

Layout per era plate:

```
┌──────────────────────────────────────────────────────────────┐
│  N° VI               ORA · 1921 – ۬                           │
│                                                              │
│  Орчин Үе                                                    │
│  Modern Era                                                  │
│                                                              │
│  <1-paragraph prose intro, italic, max 2 lines>              │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  …   (horizontal figure strip)
│  │01│  │07│  │14│  │24│  │34│  │50│                         │
│  └──┘  └──┘  └──┘  └──┘  └──┘  └──┘                         │
└──────────────────────────────────────────────────────────────┘
```

- Roman numeral oversized in display serif
- Year band in `font-meta`
- Prose intro in `prose-body italic`
- Figures render as slim `EraFigureTile` (a compact version of `FigureCard` showing only N°, name, years)
- Horizontal-scroll on mobile; wrap to a grid on desktop
- Era plates separated by `CodexRule` dividers
- Each plate anchored with `id="chapter-<key>"` so Navbar could deep-link per era in future

### 6.4 New component — `EraFigureTile`

Compact 3/4-aspect tile, roughly 80×110px, showing:
- `N° {pad}` top-left
- Portrait (or `CategoryGlyph` fallback) center
- Name + `yrs` on hover tooltip / bottom strip
- Click → `navigate('/figure/' + fig_id)`

This is a lighter sibling of `FigureCard` used only inside chapter strips.

---

## 7. File changes

Additive-only changes (no functional removals):

| File | Change |
|---|---|
| `src/lib/figuresData.js`              | Add `ERAS`, `ERA_OVERRIDES`, `getEra`. |
| `src/components/GallerySection.jsx`   | Add era filter row; compose filters. |
| `src/components/Navbar.jsx`           | Add `VI. Бүлгүүд` nav entry. |
| `src/pages/Home.jsx`                  | Render `<ChaptersSection>` between gallery and map. |
| `src/components/ChaptersSection.jsx`  | **New** component. |
| `src/components/EraFigureTile.jsx`    | **New** compact figure tile. |

No migrations, no data writes — all derivation is read-side.

---

## 8. Acceptance criteria

1. Every one of the 52 figures resolves to exactly one era via `getEra()`. (Spot-check: Alan Gua → founding; Marco Polo → yuan; Gürragchaa → modern; Genghis → founding; Kublai → yuan.)
2. Gallery filter shows era chips as a second row; activating any era filter reduces the result set correctly; era + category filter composes (AND).
3. Home has a `#chapters` section with 6 era plates, each plate containing ≥1 figure tile, ordered I → VI.
4. Navbar has **VI. Бүлгүүд** item that scrolls to `#chapters` smoothly.
5. No era plate is visually empty (no plate-with-zero-figures pitfall).
6. Vite dev server transforms every touched file without error; no console runtime errors when browsing the Home page.

---

## 9. Open questions

None at this stage. Prose intros for each era will be authored during implementation (short, Mongolian, ≤2 lines).

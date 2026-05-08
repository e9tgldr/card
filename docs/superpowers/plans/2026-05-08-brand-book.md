# Altan Domog Brand Book — v1 Web Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, lazy-loaded `/v2/brand` route inside the existing `mongol-history-hub` app that renders the Altan Domog brand book — 11 chapters, ~24 pages, 7 spread primitives, Mongolian primary with English summaries, reusing the existing Codex tokens. Seven chapters ship with full content; four ship as `[FILL]`-flagged stubs. PDF generation is deferred to phase 2. The route is namespaced under `/v2` to match the existing v2 routing convention (`/v2`, `/v2/app`).

**Architecture:** Markdown content files under `docs/brand-book/` are the source of truth. Each chapter is a small React component under `src/pages/brand/chapters/` that imports its markdown via Vite's `?raw` import, parses labelled sections with a tiny helper, and composes them with seven layout primitives (`Spread`, `Plate`, `EditorialBody`, `Specimen`, `PullQuote`, `MarginNote`, `BrassRule`). A single `BrandBook.jsx` mounts all chapters in scroll order with sub-anchor IDs. Existing Codex CSS variables (ink/ivory/brass/bronze/seal) and font tokens (`--font-display`, `--font-prose`, `--font-meta`, `--font-bichig`) are reused unchanged.

**Tech Stack:** React 18, Vite, React Router, Tailwind, Vitest, @testing-library/react. No new runtime dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-08-brand-book-design.md`](../specs/2026-05-08-brand-book-design.md)

---

## File Structure

**New files (created by this plan):**

```
docs/brand-book/                              ← content source of truth
├── README.md
├── 00-cover.md
├── 01-mission.md
├── 02-the-52.md
├── 03-product-experience.md
├── 04-by-the-numbers.md           [stub]
├── 05-anatomy-of-card.md
├── 06-editorial-principles.md     [stub]
├── 07-partnership-use-cases.md    [stub]
├── 08-partnership-ask.md
├── 09-credibility.md              [stub]
└── 10-press-kit.md

src/pages/brand/                              ← React render
├── BrandBook.jsx                   route entry
├── parseChapter.js                 markdown section parser
├── parseChapter.test.js
├── print.css                       phase-2 stub
├── primitives/
│   ├── BrassRule.jsx
│   ├── BrassRule.test.jsx
│   ├── MarginNote.jsx
│   ├── MarginNote.test.jsx
│   ├── PullQuote.jsx
│   ├── PullQuote.test.jsx
│   ├── Plate.jsx
│   ├── Plate.test.jsx
│   ├── Spread.jsx
│   ├── Spread.test.jsx
│   ├── EditorialBody.jsx
│   ├── EditorialBody.test.jsx
│   ├── Specimen.jsx
│   └── Specimen.test.jsx
├── chapters/
│   ├── Cover.jsx
│   ├── Mission.jsx
│   ├── The52.jsx
│   ├── ProductExperience.jsx
│   ├── ByTheNumbers.jsx
│   ├── AnatomyOfCard.jsx
│   ├── EditorialPrinciples.jsx
│   ├── PartnershipUseCases.jsx
│   ├── PartnershipAsk.jsx
│   ├── Credibility.jsx
│   └── PressKit.jsx
└── BrandBook.test.jsx              integration smoke test
```

**Modified files:**
- `src/App.jsx` — one new lazy route registration

---

## Task 1: Register `/v2/brand` lazy route (skeleton)

**Files:**
- Modify: `src/App.jsx`
- Create: `src/pages/brand/BrandBook.jsx` (skeleton)

- [ ] **Step 1: Create skeleton BrandBook.jsx**

Create `src/pages/brand/BrandBook.jsx`:

```jsx
export default function BrandBook() {
  return (
    <main className="min-h-screen bg-ink text-ivory" data-testid="brand-book">
      <h1 className="font-display text-4xl p-8">Altan Domog Brand Book</h1>
      <p className="font-meta text-brass p-8">Under construction</p>
    </main>
  );
}
```

- [ ] **Step 2: Add lazy route registration in `src/App.jsx`**

After the existing `MultiTargetARView` lazy import on line 8, add:

```jsx
const BrandBook = lazy(() => import('@/pages/brand/BrandBook'));
```

Inside the `<Routes>` block, after the `/ar` route (around line 106), before the catch-all `*` route, add:

```jsx
<Route
  path="/v2/brand"
  element={
    <Suspense fallback={
      <div className="fixed inset-0 bg-ink flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-brass rounded-full animate-spin" />
      </div>
    }>
      <BrandBook />
    </Suspense>
  }
/>
```

The route is intentionally **not** wrapped in `OtpGate` — the brand book is public. It sits next to `/v2` (LandingV2) and `/v2/app` (HomeV2).

- [ ] **Step 3: Manual sanity check**

Run: `npm run dev`
Navigate to `http://localhost:5173/v2/brand`
Expected: dark page, "Altan Domog Brand Book" heading in display font, "Under construction" in brass mono.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/pages/brand/BrandBook.jsx
git commit -m "feat(brand): scaffold /v2/brand lazy route"
```

---

## Task 2: Create docs/brand-book/ scaffolding with content

**Files:**
- Create: `docs/brand-book/README.md`
- Create: `docs/brand-book/00-cover.md` through `10-press-kit.md` (11 files)

- [ ] **Step 1: Create the README**

Create `docs/brand-book/README.md`:

```markdown
# Altan Domog Brand Book — Content

This folder is the **source of truth** for the brand book copy. Each `NN-<chapter>.md` file is read at build time by `src/pages/brand/chapters/<Chapter>.jsx` via Vite's `?raw` import and parsed by `parseChapter.js`.

## Editing rules

- Edit the `.md` files here, not the `.jsx` components.
- Each chapter file uses labelled sections: `## STATUS`, `## PAGES`, `## TITLE_MN`, `## TITLE_EN`, `## MN`, `## EN`, optional `## QUOTE`, `## ATTRIBUTION`, `## CALLOUTS`, `## ASK`, `## NOTE`.
- The parser is regex-based and forgiving on whitespace, but section headers must be exactly `## SECTION_NAME` on their own line.
- For stubbed chapters (`STATUS: stub`), keep `[FILL]` markers in body text — they are asserted in tests so stubs cannot silently look complete.

## Chapter list

| # | File | Status | Pages |
|---|---|---|---|
| — | `00-cover.md` | built | 2 |
| 1 | `01-mission.md` | built | 2 |
| 2 | `02-the-52.md` | built | 3 |
| 3 | `03-product-experience.md` | built | 3 |
| 4 | `04-by-the-numbers.md` | stub | 2 |
| 5 | `05-anatomy-of-card.md` | built | 3 |
| 6 | `06-editorial-principles.md` | stub | 2 |
| 7 | `07-partnership-use-cases.md` | stub | 3 |
| 8 | `08-partnership-ask.md` | built | 1 |
| 9 | `09-credibility.md` | stub | 1 |
| — | `10-press-kit.md` | built | 2 |

## Voice

Dignified, evidence-led, accessible, culturally rooted. See spec §3.6.
```

- [ ] **Step 2: Create `00-cover.md`**

```markdown
## STATUS
built

## PAGES
2

## TITLE_MN
Алтан Домог

## TITLE_EN
Altan Domog

## TAGLINE_MN
52 Агуу Зүтгэлтэн · Нэг Хөзрийн Баглаа

## TAGLINE_EN
A Codex of Fifty-Two

## DEDICATION_MN
Бидний өмнө явсан, бидний дараа мэдэх хүмүүст

## DEDICATION_EN
For those who came before, and those who will know them again
```

- [ ] **Step 3: Create `01-mission.md`**

```markdown
## STATUS
built

## PAGES
2

## TITLE_MN
Эрхэм зорилго

## TITLE_EN
Mission & Origin

## MN
Алтан Домог нь Монголын түүхийн 52 агуу зүтгэлтнийг нэг хөзрийн баглаанд багтаан, орчин үеийн уншигч, оюутан, аяллын жуулчдад хүртээлтэй болгоход чиглэсэн соёлын төсөл юм.

Бид түүхийг гажуудуулж шүтэлгүйгээр, харин баримт, эх сурвалж, нарийн зураглалтайгаар дэлгэн харуулна. Хан, эзэн хаан, цэргийн жанжин төдийгүй эрдэмтэн, уран бүтээлч, шинэчлэгчдийг хамтад нь нэг шугаманд тавьж, монгол хүний түүхэн өв үнэхээр өргөн гэдгийг харуулах нь бидний зорилго.

## EN
Altan Domog brings the fifty-two great figures of Mongolian history into a single deck of cards — a codex made for modern readers, students, and travellers. We present history evidence-led and unflattened: rulers and conquerors stand alongside scholars, artists, and reformers, drawn from primary sources, dated, and named in both Cyrillic and traditional script where they exist. The aim is breadth and dignity: to show the full register of Mongolian historical inheritance to a generation that will inherit it.

## QUOTE
Түүхийг бид мартахгүй байж л өвлөнө.

## ATTRIBUTION
— Founder's note
```

- [ ] **Step 4: Create `02-the-52.md`**

```markdown
## STATUS
built

## PAGES
3

## TITLE_MN
Тавин хоёр

## TITLE_EN
The Fifty-Two

## MN
Хөзрийн баглаа дотор 52 хүн бий — яг хуучин Европын хөзрийн адил тоо. Гэвч энэ бол санамсаргүй биш: 52 нь жилийн долоо хоног, нэг тойргийн дотор багтах түүхийн бүрэн нөмрөг.

52 зүтгэлтнийг бид дөрвөн эриний дагуу баглав: Эртний Монгол · Их Монгол Улс · Дундад үе · Орчин үе. Эрин бүрд хан, эрдэмтэн, уран бүтээлч, шинэчлэгч багтсан байх ба нэг эрин нөгөөгөө дарахгүй байхаар тэнцвэртэй сонголсон.

## EN
Fifty-two figures fill the deck — the same number as a Western playing-card pack, and the same number as the weeks in a year. The arithmetic is intentional: a complete year of Mongolian history, one figure at a time, balanced across four eras (Early Mongolia · The Great Mongol Empire · Middle period · Modern era). Each era contains rulers, scholars, artists, and reformers; no era dominates the others.

## NOTE
The era grouping mirrors the existing app structure (`docs/superpowers/specs/2026-04-22-chapter-era-grouping-design.md`). Designers should reuse the existing era colour mapping rather than introduce new accents.
```

- [ ] **Step 5: Create `03-product-experience.md`**

```markdown
## STATUS
built

## PAGES
3

## TITLE_MN
Бүтээгдэхүүний туршлага

## TITLE_EN
Product Experience

## MN
Алтан Домог нь зүгээр нэг хөзөр биш — мэдлэг, тоглоом, нөхөрлөл нийлсэн дижитал орон зай.

Хэрэглэгч хөзөр бүрийг гар утсаар зүтгэлтний эх сурвалжид шууд хүргэдэг QR-AI хөтөч, олон нийтийн "ишлэл таах" тоглоом, амьд олон тоглогчтой өрсөлдөөн, өөрийн хувийн цуглуулга гэсэн дөрвөн үндсэн модулиар сэдэв бүрд гүн орох боломжтой.

## EN
Altan Domog is more than a deck. Each card is a doorway: scan its QR and an AI guide opens, citing primary sources for the figure on the card; play the public quote-guessing game alone or in real-time multiplayer rooms; build a personal collection card by card. Four modules — story tour, quote game, live multiplayer, personal collection — let learners go as deep on a figure as they want.

## CALLOUTS
QR-AI Хөтөч | QR-AI guide
Ишлэл таах тоглоом | Quote game
Амьд өрсөлдөөн | Live multiplayer
Хувийн цуглуулга | Personal collection
```

- [ ] **Step 6: Create `04-by-the-numbers.md` (stub)**

```markdown
## STATUS
stub

## PAGES
2

## TITLE_MN
Тоон үзүүлэлт

## TITLE_EN
By the Numbers

## MN
[FILL] Хэрэглэгчийн тоо, сургуулийн тоо, тоглосон тоглоомын нийт тоо зэрэг бодит үзүүлэлтүүдийг энд оруулна.

## EN
[FILL] Real metrics: total daily active users, schools using the deck, total story-tour completions, total quote-game rounds played, languages supported. To be filled by the user before the chapter ships.
```

- [ ] **Step 7: Create `05-anatomy-of-card.md`**

```markdown
## STATUS
built

## PAGES
3

## TITLE_MN
Хөзрийн бүтэц

## TITLE_EN
Anatomy of a Card

## MN
Хөзөр бүр долоон элементээс бүрдэнэ: дүрс, монгол бичгээр бичсэн нэр, эриний туузан тэмдэг, гавьяаны зураглал, ишлэлийн мөр, эх сурвалжийн тамга, ховор зэрэглэлийн тэмдэг.

Эдгээр элементүүд нь дур зоргоор биш — хөзрийн дотроос гадагшаа, дүрснээс эх сурвалжид чиглэсэн мэдлэгийн дараалал юм. Дүрс нь хүнийг танилцуулж, нэр баталж, эрин нь түүхэнд байрлуулж, гавьяа нь яагаад чухал болохыг, ишлэл нь хүний дуу хоолойг, тамга нь үүнийг хэн баталснаас, ховор зэрэг нь цуглуулагчийн интерес.

## EN
Every card has seven elements, ordered from portrait to source: ① portrait region, ② name in traditional script (vertical), ③ era ribbon, ④ achievement glyph, ⑤ quote line, ⑥ source seal, ⑦ rarity indicator. The order is not decorative — it walks the reader from a face, to a verified identity, to a moment in history, to why that moment matters, to a recorded voice, to who attests, to the collector's interest.

## CALLOUTS
1 | Дүрс | Portrait region
2 | Монгол бичгээр нэр | Name (vertical script)
3 | Эриний туузан тэмдэг | Era ribbon
4 | Гавьяаны зураглал | Achievement glyph
5 | Ишлэлийн мөр | Quote line
6 | Эх сурвалжийн тамга | Source seal
7 | Ховор зэрэглэл | Rarity indicator
```

- [ ] **Step 8: Create `06-editorial-principles.md` (stub)**

```markdown
## STATUS
stub

## PAGES
2

## TITLE_MN
Редакцийн зарчим

## TITLE_EN
Editorial Principles

## MN
[FILL] 52 хүнийг хэрхэн сонгосон, эрдэмтэн зөвлөл байгаа эсэх, маргаантай дүрсүүдийг хэрхэн хүлээн зөвшөөрдөг талаар тайлбар.

## EN
[FILL] How the 52 figures are chosen and reviewed; the editorial board (or named governance gap if none yet exists); how disputed legacies and contested histories are handled; how corrections and expert feedback are incorporated. To be drafted with the user.
```

- [ ] **Step 9: Create `07-partnership-use-cases.md` (stub)**

```markdown
## STATUS
stub

## PAGES
3

## TITLE_MN
Хамтын ажиллагааны хэрэглээ

## TITLE_EN
Partnership Use Cases

## MN
[FILL] Яам, музей, сургууль, ивээн тэтгэгч, хэвлэл мэдээлэл — хамтрагч тус бүрд яаж ашиглахыг бодит жишээгээр харуулна.

## EN
[FILL] Five named partner scenarios with concrete deployment paths: ministry rollout, museum activation, school program, sponsor campaign, press kit. Each scenario shows app screens / posters / event banners specific to that use. To be drafted once real partner conversations are in motion.
```

- [ ] **Step 10: Create `08-partnership-ask.md`**

```markdown
## STATUS
built

## PAGES
1

## TITLE_MN
Хүсэлт

## TITLE_EN
What We Ask

## MN
Алтан Домогийг өргөжүүлэхэд бид дараах есөн чиглэлээр хамтрагчийг урьж байна.

## EN
Nine ways to support Altan Domog. We invite partnership in any of them — a conversation begins with one.

## ASK
Сургуулийн хэрэглээ | School access | Бүх сургуулийн сурагчид үнэ төлбөргүй ашиглах эрх | Free educational access for a school district
QR суурилуулалт | QR installations | Музей, дурсгалт газарт QR-AI хөтөчийг ашиглах | QR-AI guide kiosks for museums and heritage sites
Ивээн тэтгэх багц | Sponsored figure set | 4 хөзрийн багц, ивээн тэтгэгчийн тэмдэг хөзрийн ард | A 4-card set with sponsor mark on the card backs
Үйл явдал | Live events | Олон тоглогчийн тэмцээн, нээлт, лекц | Multiplayer tournaments, launches, lectures
Хэвлэн нийтлэл | Press distribution | Хэвлэлийн багц, ярилцлагын материал | Press packets, interview materials
Гадаад хамтрал | International partnerships | Музей, их сургууль, монгол судлалын төв | Museums, universities, Mongolian-studies centers
Орчуулга | Translation | Англи, орос, хятад, япон | Into English, Russian, Chinese, Japanese
Шинэ дүрс | New figure | Шинэ хөзрийн ивээн тэтгэгч | Sponsor a new figure card
Ярианы эхлэл | Begin a conversation | Бусад санаа байвал | Anything else not on this list

## NOTE
Contact line: hello@altandomog.mn (placeholder — confirm with user)
```

- [ ] **Step 11: Create `09-credibility.md` (stub)**

```markdown
## STATUS
stub

## PAGES
1

## TITLE_MN
Найдвар, хариуцлага

## TITLE_EN
Credibility & Stewardship

## MN
[FILL] Үндэслэгч, зөвлөх, түүхч, боловсролын мэргэжилтнүүдийн нэр, үүрэг, харилцагдах эрхэм холбоосууд.

## EN
[FILL] Founder, advisors, historians, educators — names, roles, affiliations, contact. Even one founder + two advisors is enough; ministries especially require this. If the team is incomplete, the chapter still ships, with a clear "advisor positions open" line so the gap is named, not hidden.
```

- [ ] **Step 12: Create `10-press-kit.md`**

```markdown
## STATUS
built

## PAGES
2

## TITLE_MN
Хэвлэлийн багц

## TITLE_EN
Press Kit & Colophon

## MN
Хэвлэлд ашиглах боломжтой материал, тэмдэг, гэрэл зураг, харилцах хаяг.

## EN
Approved short description, logo lockups, screenshots for press use, founder quote, contact.

## SHORT_DESC_MN
Алтан Домог нь Монголын түүхийн 52 агуу зүтгэлтнийг хөзрийн баглаа болгон харуулсан, Монгол, Англи хэлтэй боловсролын апп юм.

## SHORT_DESC_EN
Altan Domog is a Mongolian-and-English educational app that presents the fifty-two great figures of Mongolian history as an interactive card deck.

## CONTACT
hello@altandomog.mn
```

- [ ] **Step 13: Commit**

```bash
git add docs/brand-book/
git commit -m "docs(brand): seed brand-book content scaffolding (11 chapters, 7 built + 4 stubs)"
```

---

## Task 3: Build `parseChapter.js` helper (TDD)

**Files:**
- Create: `src/pages/brand/parseChapter.js`
- Create: `src/pages/brand/parseChapter.test.js`

- [ ] **Step 1: Write failing test**

Create `src/pages/brand/parseChapter.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseChapter } from './parseChapter';

describe('parseChapter', () => {
  it('parses simple labelled sections', () => {
    const raw = `## STATUS
built

## TITLE_MN
Эрхэм зорилго

## TITLE_EN
Mission

## MN
Эхний догол.

Хоёр дахь догол.

## EN
First paragraph.

Second.`;

    const out = parseChapter(raw);
    expect(out.STATUS).toBe('built');
    expect(out.TITLE_MN).toBe('Эрхэм зорилго');
    expect(out.TITLE_EN).toBe('Mission');
    expect(out.MN).toContain('Эхний догол.');
    expect(out.MN).toContain('Хоёр дахь догол.');
    expect(out.EN).toContain('First paragraph.');
  });

  it('returns empty object on empty input', () => {
    expect(parseChapter('')).toEqual({});
  });

  it('preserves multiline section bodies', () => {
    const raw = `## MN
Line one.
Line two.
Line three.`;
    expect(parseChapter(raw).MN).toBe('Line one.\nLine two.\nLine three.');
  });

  it('parses CALLOUTS as array of pipe-separated rows', () => {
    const raw = `## CALLOUTS
1 | Дүрс | Portrait
2 | Нэр | Name`;
    const out = parseChapter(raw);
    expect(out.CALLOUTS).toEqual([
      ['1', 'Дүрс', 'Portrait'],
      ['2', 'Нэр', 'Name'],
    ]);
  });

  it('parses ASK as array of pipe-separated rows', () => {
    const raw = `## ASK
A | B | C | D
E | F | G | H`;
    expect(parseChapter(raw).ASK).toHaveLength(2);
    expect(parseChapter(raw).ASK[0]).toEqual(['A', 'B', 'C', 'D']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/brand/parseChapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/pages/brand/parseChapter.js`:

```js
const PIPE_SECTIONS = new Set(['CALLOUTS', 'ASK']);

export function parseChapter(raw) {
  if (!raw || typeof raw !== 'string') return {};
  const out = {};
  const sections = raw.split(/^## (\w+)\s*$/m);
  // sections[0] is preamble (ignored); then alternating [name, body, name, body, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const name = sections[i];
    const body = (sections[i + 1] || '').trim();
    if (PIPE_SECTIONS.has(name)) {
      out[name] = body
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => l.split('|').map((c) => c.trim()));
    } else {
      out[name] = body;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/pages/brand/parseChapter.test.js`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/parseChapter.js src/pages/brand/parseChapter.test.js
git commit -m "feat(brand): add parseChapter section helper"
```

---

## Task 4: Build `BrassRule` primitive

**Files:**
- Create: `src/pages/brand/primitives/BrassRule.jsx`
- Create: `src/pages/brand/primitives/BrassRule.test.jsx`

A hairline brass rule used to point from a callout to an element on a Specimen page. Renders an SVG line.

- [ ] **Step 1: Write failing test**

Create `src/pages/brand/primitives/BrassRule.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BrassRule from './BrassRule';

describe('BrassRule', () => {
  it('renders an svg line element', () => {
    const { container } = render(<BrassRule from={[0, 0]} to={[100, 100]} />);
    const line = container.querySelector('line');
    expect(line).toBeTruthy();
    expect(line.getAttribute('x1')).toBe('0');
    expect(line.getAttribute('y1')).toBe('0');
    expect(line.getAttribute('x2')).toBe('100');
    expect(line.getAttribute('y2')).toBe('100');
  });

  it('uses brass stroke colour by default', () => {
    const { container } = render(<BrassRule from={[0, 0]} to={[10, 10]} />);
    const line = container.querySelector('line');
    expect(line.getAttribute('stroke')).toBe('hsl(var(--brass))');
  });

  it('renders aria-hidden so it is invisible to screen readers', () => {
    const { container } = render(<BrassRule from={[0, 0]} to={[10, 10]} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/pages/brand/primitives/BrassRule.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/pages/brand/primitives/BrassRule.jsx`:

```jsx
export default function BrassRule({ from, to, strokeWidth = 0.5 }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.abs(x2 - x1) || 1;
  const h = Math.abs(y2 - y1) || 1;
  return (
    <svg
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{ left: minX, top: minY, width: w, height: h, overflow: 'visible' }}
      width={w}
      height={h}
    >
      <line
        x1={x1 - minX}
        y1={y1 - minY}
        x2={x2 - minX}
        y2={y2 - minY}
        stroke="hsl(var(--brass))"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/pages/brand/primitives/BrassRule.test.jsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/primitives/BrassRule.jsx src/pages/brand/primitives/BrassRule.test.jsx
git commit -m "feat(brand): add BrassRule primitive"
```

---

## Task 5: Build `MarginNote` primitive

**Files:**
- Create: `src/pages/brand/primitives/MarginNote.jsx`
- Create: `src/pages/brand/primitives/MarginNote.test.jsx`

Small mono-spaced brass note rendered in the right margin of editorial spreads.

- [ ] **Step 1: Write failing test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarginNote from './MarginNote';

describe('MarginNote', () => {
  it('renders the children inside an aside', () => {
    render(<MarginNote>1162—1227</MarginNote>);
    const note = screen.getByText('1162—1227');
    expect(note.tagName.toLowerCase()).toBe('aside');
  });

  it('uses the meta (mono) font and brass colour', () => {
    render(<MarginNote>note</MarginNote>);
    const note = screen.getByText('note');
    expect(note.className).toContain('font-meta');
    expect(note.className).toContain('text-brass');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/pages/brand/primitives/MarginNote.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/pages/brand/primitives/MarginNote.jsx`:

```jsx
export default function MarginNote({ children }) {
  return (
    <aside className="font-meta text-brass text-xs uppercase tracking-wider opacity-80">
      {children}
    </aside>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run src/pages/brand/primitives/MarginNote.test.jsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/primitives/MarginNote.jsx src/pages/brand/primitives/MarginNote.test.jsx
git commit -m "feat(brand): add MarginNote primitive"
```

---

## Task 6: Build `PullQuote` primitive

**Files:**
- Create: `src/pages/brand/primitives/PullQuote.jsx`
- Create: `src/pages/brand/primitives/PullQuote.test.jsx`

Large display-font quote with brass attribution rule.

- [ ] **Step 1: Write failing test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PullQuote from './PullQuote';

describe('PullQuote', () => {
  it('renders the quote text inside a blockquote', () => {
    render(<PullQuote text="Түүхийг бид мартахгүй байж л өвлөнө." attribution="— Founder" />);
    expect(screen.getByText(/Түүхийг бид мартахгүй/)).toBeTruthy();
    const bq = screen.getByText(/Түүхийг бид мартахгүй/).closest('blockquote');
    expect(bq).toBeTruthy();
  });

  it('renders the attribution', () => {
    render(<PullQuote text="X" attribution="— Founder" />);
    expect(screen.getByText('— Founder')).toBeTruthy();
  });

  it('omits attribution when none is supplied', () => {
    render(<PullQuote text="X" />);
    expect(screen.queryByText(/—/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/pages/brand/primitives/PullQuote.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/pages/brand/primitives/PullQuote.jsx`:

```jsx
export default function PullQuote({ text, attribution }) {
  return (
    <blockquote className="my-12 border-l-2 border-brass pl-6 max-w-2xl">
      <p className="font-display text-2xl md:text-3xl leading-snug text-ivory italic">
        {text}
      </p>
      {attribution && (
        <footer className="font-meta text-brass text-xs uppercase tracking-wider mt-3">
          {attribution}
        </footer>
      )}
    </blockquote>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run src/pages/brand/primitives/PullQuote.test.jsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/primitives/PullQuote.jsx src/pages/brand/primitives/PullQuote.test.jsx
git commit -m "feat(brand): add PullQuote primitive"
```

---

## Task 7: Build `Plate` primitive

**Files:**
- Create: `src/pages/brand/primitives/Plate.jsx`
- Create: `src/pages/brand/primitives/Plate.test.jsx`

Full-bleed dark plate with chapter number lower-left and Mongolian title centered along the bottom seal-strip. v1 uses a dark ground; if `imageSrc` is supplied it renders as background.

- [ ] **Step 1: Write failing test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Plate from './Plate';

describe('Plate', () => {
  it('renders the chapter number and Mongolian title', () => {
    render(<Plate number="I" titleMn="Эрхэм зорилго" titleEn="Mission" />);
    expect(screen.getByText('I')).toBeTruthy();
    expect(screen.getByText('Эрхэм зорилго')).toBeTruthy();
  });

  it('marks the title element with lang="mn"', () => {
    render(<Plate number="I" titleMn="Х" titleEn="Mission" />);
    const mn = screen.getByText('Х');
    expect(mn.getAttribute('lang')).toBe('mn');
  });

  it('renders an alt text for the placeholder dark plate', () => {
    render(<Plate number="I" titleMn="Х" titleEn="Mission" />);
    const region = screen.getByRole('img', { name: /Mission/ });
    expect(region).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/pages/brand/primitives/Plate.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/pages/brand/primitives/Plate.jsx`:

```jsx
export default function Plate({ number, titleMn, titleEn, imageSrc }) {
  return (
    <section
      role="img"
      aria-label={`Plate ${number} — ${titleEn}`}
      className="relative w-full h-screen bg-ink overflow-hidden"
      style={imageSrc ? { backgroundImage: `url(${imageSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <span className="absolute left-8 bottom-8 font-meta text-brass text-sm uppercase tracking-widest">
        Plate {number}
      </span>
      <div className="absolute inset-x-0 bottom-0 border-t border-brass/40 py-6 text-center">
        <h2 lang="mn" className="font-display text-3xl md:text-4xl text-ivory">
          {titleMn}
        </h2>
        <p lang="en" className="font-meta text-brass/70 text-xs mt-1 uppercase tracking-widest">
          {titleEn}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run src/pages/brand/primitives/Plate.test.jsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/primitives/Plate.jsx src/pages/brand/primitives/Plate.test.jsx
git commit -m "feat(brand): add Plate primitive (full-bleed chapter opener)"
```

---

## Task 8: Build `Spread` primitive

**Files:**
- Create: `src/pages/brand/primitives/Spread.jsx`
- Create: `src/pages/brand/primitives/Spread.test.jsx`

A two-page composition wrapper. Provides A4-aspect grid container with consistent margins. Used by chapter components to compose body and specimen content.

- [ ] **Step 1: Write failing test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spread from './Spread';

describe('Spread', () => {
  it('renders children inside a section with a chapter id', () => {
    render(<Spread id="mission"><p>hello</p></Spread>);
    const section = screen.getByText('hello').closest('section');
    expect(section.id).toBe('mission');
  });

  it('renders children inside the spread', () => {
    render(<Spread id="x"><p>body</p></Spread>);
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('uses bg-ink and text-ivory tokens', () => {
    render(<Spread id="x"><p>body</p></Spread>);
    const section = screen.getByText('body').closest('section');
    expect(section.className).toContain('bg-ink');
    expect(section.className).toContain('text-ivory');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/pages/brand/primitives/Spread.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/pages/brand/primitives/Spread.jsx`:

```jsx
export default function Spread({ id, children, className = '' }) {
  return (
    <section
      id={id}
      className={`bg-ink text-ivory min-h-screen px-6 md:px-16 py-16 md:py-24 ${className}`}
    >
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run src/pages/brand/primitives/Spread.test.jsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/primitives/Spread.jsx src/pages/brand/primitives/Spread.test.jsx
git commit -m "feat(brand): add Spread primitive"
```

---

## Task 9: Build `EditorialBody` primitive

**Files:**
- Create: `src/pages/brand/primitives/EditorialBody.jsx`
- Create: `src/pages/brand/primitives/EditorialBody.test.jsx`

Two-column asymmetric body: Mongolian copy in wider left column, English summary in narrower italic right column.

- [ ] **Step 1: Write failing test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorialBody from './EditorialBody';

describe('EditorialBody', () => {
  it('renders mn and en copy with correct lang attributes', () => {
    render(<EditorialBody mn="Эрхэм зорилго" en="Our mission" />);
    const mn = screen.getByText('Эрхэм зорилго');
    const en = screen.getByText('Our mission');
    expect(mn.getAttribute('lang')).toBe('mn');
    expect(en.getAttribute('lang')).toBe('en');
  });

  it('renders multi-paragraph mn copy split on blank lines', () => {
    render(<EditorialBody mn={"Para one.\n\nPara two."} en="Eng" />);
    expect(screen.getByText('Para one.')).toBeTruthy();
    expect(screen.getByText('Para two.')).toBeTruthy();
  });

  it('uses italic styling on the english column', () => {
    render(<EditorialBody mn="X" en="Y" />);
    const en = screen.getByText('Y');
    expect(en.className).toContain('italic');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/pages/brand/primitives/EditorialBody.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/pages/brand/primitives/EditorialBody.jsx`:

```jsx
function paras(text) {
  return (text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export default function EditorialBody({ mn, en }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
      <div className="md:col-span-7 space-y-5">
        {paras(mn).map((p, i) => (
          <p key={i} lang="mn" className="font-prose text-ivory text-lg leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      <div className="md:col-span-5 space-y-4 md:border-l md:border-brass/30 md:pl-8">
        {paras(en).map((p, i) => (
          <p key={i} lang="en" className="font-prose text-ivory-dim text-sm italic leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run src/pages/brand/primitives/EditorialBody.test.jsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/primitives/EditorialBody.jsx src/pages/brand/primitives/EditorialBody.test.jsx
git commit -m "feat(brand): add EditorialBody primitive"
```

---

## Task 10: Build `Specimen` primitive

**Files:**
- Create: `src/pages/brand/primitives/Specimen.jsx`
- Create: `src/pages/brand/primitives/Specimen.test.jsx`

Specimen page: a hero element with numbered callouts. Layout primitive; the specific hero (card image, app screenshot, etc.) is passed as `children`.

- [ ] **Step 1: Write failing test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Specimen from './Specimen';

describe('Specimen', () => {
  it('renders the hero children', () => {
    render(<Specimen callouts={[]}><img alt="hero" /></Specimen>);
    expect(screen.getByAltText('hero')).toBeTruthy();
  });

  it('renders each callout as numbered row with mn and en', () => {
    const callouts = [
      ['1', 'Дүрс', 'Portrait'],
      ['2', 'Нэр', 'Name'],
    ];
    render(<Specimen callouts={callouts}><div /></Specimen>);
    expect(screen.getByText('Дүрс')).toBeTruthy();
    expect(screen.getByText('Portrait')).toBeTruthy();
    expect(screen.getByText('Нэр')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('renders nothing in callout list when callouts is empty', () => {
    const { container } = render(<Specimen callouts={[]}><div /></Specimen>);
    expect(container.querySelectorAll('[data-callout]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/pages/brand/primitives/Specimen.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/pages/brand/primitives/Specimen.jsx`:

```jsx
export default function Specimen({ callouts = [], children }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
      <div className="flex items-center justify-center">{children}</div>
      <ol className="space-y-5">
        {callouts.map((row, i) => {
          const [num, mn, en] = row;
          return (
            <li key={i} data-callout className="flex gap-4 items-baseline border-t border-brass/30 pt-3">
              <span className="font-meta text-brass text-xs">{num}</span>
              <div className="flex-1">
                <span lang="mn" className="font-prose text-ivory text-base">{mn}</span>
                <span className="mx-2 text-ivory-dim/40">·</span>
                <span lang="en" className="font-prose text-ivory-dim text-sm italic">{en}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run src/pages/brand/primitives/Specimen.test.jsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/primitives/Specimen.jsx src/pages/brand/primitives/Specimen.test.jsx
git commit -m "feat(brand): add Specimen primitive"
```

---

## Task 11: Cover chapter

**Files:**
- Create: `src/pages/brand/chapters/Cover.jsx`

The Cover does not use Plate; it has its own composition (centered seal, dedication on inside cover).

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/Cover.jsx`:

```jsx
import raw from '../../../../docs/brand-book/00-cover.md?raw';
import { parseChapter } from '../parseChapter';

const c = parseChapter(raw);

export default function Cover() {
  return (
    <>
      <section id="cover" className="bg-ink text-ivory min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="w-32 h-32 rounded-full border border-brass/60 flex items-center justify-center mb-12">
          <span lang="mn" className="font-display text-2xl text-brass">{c.TITLE_MN}</span>
        </div>
        <p lang="mn" className="font-prose text-ivory text-lg max-w-md">{c.TAGLINE_MN}</p>
        <p lang="en" className="font-meta text-brass/70 text-xs uppercase tracking-widest mt-3">{c.TAGLINE_EN}</p>
      </section>
      <section id="cover-inside" className="bg-ink text-ivory min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p lang="mn" className="font-display text-xl md:text-2xl text-ivory max-w-md italic mb-3">
          {c.DEDICATION_MN}
        </p>
        <p lang="en" className="font-prose text-ivory-dim text-sm italic">
          {c.DEDICATION_EN}
        </p>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Manual sanity check**

Update BrandBook.jsx to include the Cover so we can see it (this will be replaced in Task 22):

```jsx
import Cover from './chapters/Cover';
export default function BrandBook() {
  return <Cover />;
}
```

Run: `npm run dev`. Visit `/brand`. Expected: dark page with brass-circle wordmark, tagline, then a second screen with the dedication.

- [ ] **Step 3: Commit**

```bash
git add src/pages/brand/chapters/Cover.jsx src/pages/brand/BrandBook.jsx
git commit -m "feat(brand): add Cover chapter"
```

---

## Task 12: Mission chapter

**Files:**
- Create: `src/pages/brand/chapters/Mission.jsx`

Plate opener + EditorialBody + PullQuote.

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/Mission.jsx`:

```jsx
import raw from '../../../../docs/brand-book/01-mission.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';
import PullQuote from '../primitives/PullQuote';

const c = parseChapter(raw);

export default function Mission() {
  return (
    <>
      <Plate number="I" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="mission">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        {c.QUOTE && <PullQuote text={c.QUOTE} attribution={c.ATTRIBUTION} />}
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/Mission.jsx
git commit -m "feat(brand): add Mission chapter"
```

---

## Task 13: The 52 chapter

**Files:**
- Create: `src/pages/brand/chapters/The52.jsx`

Plate + EditorialBody + a small note from the markdown.

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/The52.jsx`:

```jsx
import raw from '../../../../docs/brand-book/02-the-52.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';
import MarginNote from '../primitives/MarginNote';

const c = parseChapter(raw);

export default function The52() {
  return (
    <>
      <Plate number="II" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="the-52">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        {c.NOTE && (
          <div className="mt-12 max-w-md">
            <MarginNote>Designer note</MarginNote>
            <p className="font-prose text-ivory-dim text-sm italic mt-2">{c.NOTE}</p>
          </div>
        )}
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/The52.jsx
git commit -m "feat(brand): add The 52 chapter"
```

---

## Task 14: Product Experience chapter

**Files:**
- Create: `src/pages/brand/chapters/ProductExperience.jsx`

Plate + EditorialBody + a 4-callout list of modules.

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/ProductExperience.jsx`:

```jsx
import raw from '../../../../docs/brand-book/03-product-experience.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

function parseCalloutLines(raw) {
  if (!raw) return [];
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split('|').map((s) => s.trim()));
}

export default function ProductExperience() {
  const modules = c.CALLOUTS || parseCalloutLines(c.CALLOUTS_RAW);
  return (
    <>
      <Plate number="III" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="product-experience">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        {modules.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-16 border-t border-brass/30 pt-8">
            {modules.map((row, i) => (
              <li key={i} className="border-l border-brass/40 pl-4">
                <span lang="mn" className="font-display text-xl text-ivory block">{row[0]}</span>
                <span lang="en" className="font-meta text-brass/70 text-xs uppercase tracking-widest block mt-1">{row[1]}</span>
              </li>
            ))}
          </ul>
        )}
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/ProductExperience.jsx
git commit -m "feat(brand): add Product Experience chapter"
```

---

## Task 15: Anatomy of a Card chapter

**Files:**
- Create: `src/pages/brand/chapters/AnatomyOfCard.jsx`

Plate + Specimen with 7 numbered callouts. The hero is a styled placeholder card (no real portrait yet).

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/AnatomyOfCard.jsx`:

```jsx
import raw from '../../../../docs/brand-book/05-anatomy-of-card.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import Specimen from '../primitives/Specimen';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

function PlaceholderCard() {
  return (
    <div
      role="img"
      aria-label="Placeholder card showing the seven anatomy regions"
      className="w-64 h-96 bg-card border border-brass/60 rounded-md p-4 flex flex-col justify-between shadow-lg"
    >
      <div className="h-40 border border-brass/30 rounded-sm flex items-center justify-center font-meta text-brass/40 text-xs">
        ① PORTRAIT
      </div>
      <div className="space-y-2">
        <div className="font-display text-ivory text-sm">② НЭР</div>
        <div className="font-meta text-brass/70 text-[10px] uppercase tracking-widest">③ ERA</div>
        <div className="font-meta text-brass/70 text-[10px]">④ ⚔</div>
        <div className="font-prose text-ivory-dim text-xs italic">"⑤ Quote line"</div>
        <div className="flex justify-between items-end pt-2 border-t border-brass/30">
          <span className="font-meta text-brass/60 text-[10px]">⑥ SOURCE</span>
          <span className="font-meta text-brass text-[10px]">⑦ ★</span>
        </div>
      </div>
    </div>
  );
}

export default function AnatomyOfCard() {
  return (
    <>
      <Plate number="V" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="anatomy">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        <div className="mt-16 border-t border-brass/30 pt-12">
          <Specimen callouts={c.CALLOUTS || []}>
            <PlaceholderCard />
          </Specimen>
        </div>
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/AnatomyOfCard.jsx
git commit -m "feat(brand): add Anatomy of a Card chapter"
```

---

## Task 16: Partnership Ask chapter

**Files:**
- Create: `src/pages/brand/chapters/PartnershipAsk.jsx`

A single-page chapter with 9 named asks. No plate (it's a one-page chapter — the spec deliberately keeps it dense). Renders ASK rows from markdown.

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/PartnershipAsk.jsx`:

```jsx
import raw from '../../../../docs/brand-book/08-partnership-ask.md?raw';
import { parseChapter } from '../parseChapter';
import Spread from '../primitives/Spread';

const c = parseChapter(raw);

export default function PartnershipAsk() {
  const asks = c.ASK || [];
  return (
    <Spread id="partnership-ask">
      <div className="flex items-end gap-6 mb-12">
        <span className="font-display text-7xl md:text-9xl text-brass leading-none">{asks.length || 9}</span>
        <h2 lang="mn" className="font-display text-3xl md:text-5xl pb-2">{c.TITLE_MN}</h2>
      </div>
      <p lang="mn" className="font-prose text-ivory text-lg max-w-3xl">{c.MN}</p>
      <p lang="en" className="font-prose text-ivory-dim text-sm italic max-w-3xl mt-2 mb-12">{c.EN}</p>
      <ul className="divide-y divide-brass/30 border-t border-b border-brass/30">
        {asks.map((row, i) => (
          <li key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 py-4">
            <div className="md:col-span-3">
              <span lang="mn" className="font-display text-ivory text-base">{row[0]}</span>
              <span lang="en" className="font-meta text-brass/70 text-[10px] uppercase tracking-widest block">{row[1]}</span>
            </div>
            <div className="md:col-span-9">
              <span lang="mn" className="font-prose text-ivory-dim text-sm">{row[2]}</span>
              <span className="mx-2 text-ivory-dim/40">·</span>
              <span lang="en" className="font-prose text-ivory-dim/70 text-xs italic">{row[3]}</span>
            </div>
          </li>
        ))}
      </ul>
      {c.NOTE && (
        <p className="font-meta text-brass text-xs uppercase tracking-widest mt-12">
          → {c.NOTE.replace(/^Contact line:\s*/i, '')}
        </p>
      )}
    </Spread>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/PartnershipAsk.jsx
git commit -m "feat(brand): add Partnership Ask chapter"
```

---

## Task 17: Press Kit chapter

**Files:**
- Create: `src/pages/brand/chapters/PressKit.jsx`

Plate + EditorialBody + the short description in both languages + contact.

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/PressKit.jsx`:

```jsx
import raw from '../../../../docs/brand-book/10-press-kit.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

export default function PressKit() {
  return (
    <>
      <Plate number="X" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="press-kit">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        <div className="mt-16 border-t border-brass/30 pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="font-meta text-brass text-xs uppercase tracking-widest mb-2">Тайлбар (MN)</p>
            <p lang="mn" className="font-prose text-ivory text-sm">{c.SHORT_DESC_MN}</p>
          </div>
          <div>
            <p className="font-meta text-brass text-xs uppercase tracking-widest mb-2">Description (EN)</p>
            <p lang="en" className="font-prose text-ivory-dim text-sm italic">{c.SHORT_DESC_EN}</p>
          </div>
        </div>
        <p className="font-meta text-brass text-sm mt-12">→ {c.CONTACT}</p>
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/PressKit.jsx
git commit -m "feat(brand): add Press Kit chapter"
```

---

## Task 18: Stub `ByTheNumbers` chapter

**Files:**
- Create: `src/pages/brand/chapters/ByTheNumbers.jsx`

Renders a layout shell with the `[FILL]` flag visible. The `[FILL]` literal MUST be present in rendered output (asserted in tests).

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/ByTheNumbers.jsx`:

```jsx
import raw from '../../../../docs/brand-book/04-by-the-numbers.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

export default function ByTheNumbers() {
  return (
    <>
      <Plate number="IV" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="by-the-numbers">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-meta text-seal text-xs uppercase tracking-widest border border-seal/60 px-2 py-1">[FILL] STUB</span>
          <h2 lang="mn" className="font-display text-3xl md:text-5xl">{c.TITLE_MN}</h2>
        </div>
        <EditorialBody mn={c.MN} en={c.EN} />
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/ByTheNumbers.jsx
git commit -m "feat(brand): add ByTheNumbers chapter (stub)"
```

---

## Task 19: Stub `EditorialPrinciples` chapter

**Files:**
- Create: `src/pages/brand/chapters/EditorialPrinciples.jsx`

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/EditorialPrinciples.jsx`:

```jsx
import raw from '../../../../docs/brand-book/06-editorial-principles.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

export default function EditorialPrinciples() {
  return (
    <>
      <Plate number="VI" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="editorial-principles">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-meta text-seal text-xs uppercase tracking-widest border border-seal/60 px-2 py-1">[FILL] STUB</span>
          <h2 lang="mn" className="font-display text-3xl md:text-5xl">{c.TITLE_MN}</h2>
        </div>
        <EditorialBody mn={c.MN} en={c.EN} />
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/EditorialPrinciples.jsx
git commit -m "feat(brand): add EditorialPrinciples chapter (stub)"
```

---

## Task 20: Stub `PartnershipUseCases` chapter

**Files:**
- Create: `src/pages/brand/chapters/PartnershipUseCases.jsx`

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/PartnershipUseCases.jsx`:

```jsx
import raw from '../../../../docs/brand-book/07-partnership-use-cases.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

export default function PartnershipUseCases() {
  return (
    <>
      <Plate number="VII" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="partnership-use-cases">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-meta text-seal text-xs uppercase tracking-widest border border-seal/60 px-2 py-1">[FILL] STUB</span>
          <h2 lang="mn" className="font-display text-3xl md:text-5xl">{c.TITLE_MN}</h2>
        </div>
        <EditorialBody mn={c.MN} en={c.EN} />
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/PartnershipUseCases.jsx
git commit -m "feat(brand): add PartnershipUseCases chapter (stub)"
```

---

## Task 21: Stub `Credibility` chapter

**Files:**
- Create: `src/pages/brand/chapters/Credibility.jsx`

- [ ] **Step 1: Implement**

Create `src/pages/brand/chapters/Credibility.jsx`:

```jsx
import raw from '../../../../docs/brand-book/09-credibility.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

export default function Credibility() {
  return (
    <>
      <Plate number="IX" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="credibility">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-meta text-seal text-xs uppercase tracking-widest border border-seal/60 px-2 py-1">[FILL] STUB</span>
          <h2 lang="mn" className="font-display text-3xl md:text-5xl">{c.TITLE_MN}</h2>
        </div>
        <EditorialBody mn={c.MN} en={c.EN} />
      </Spread>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/chapters/Credibility.jsx
git commit -m "feat(brand): add Credibility chapter (stub)"
```

---

## Task 22: Wire `BrandBook.jsx` to mount all chapters in order

**Files:**
- Modify: `src/pages/brand/BrandBook.jsx`

Replace the placeholder version with the real composition.

- [ ] **Step 1: Replace BrandBook.jsx**

```jsx
import Cover from './chapters/Cover';
import Mission from './chapters/Mission';
import The52 from './chapters/The52';
import ProductExperience from './chapters/ProductExperience';
import ByTheNumbers from './chapters/ByTheNumbers';
import AnatomyOfCard from './chapters/AnatomyOfCard';
import EditorialPrinciples from './chapters/EditorialPrinciples';
import PartnershipUseCases from './chapters/PartnershipUseCases';
import PartnershipAsk from './chapters/PartnershipAsk';
import Credibility from './chapters/Credibility';
import PressKit from './chapters/PressKit';
import './print.css';

export default function BrandBook() {
  return (
    <main className="bg-ink text-ivory" data-testid="brand-book" lang="mn">
      <Cover />
      <Mission />
      <The52 />
      <ProductExperience />
      <ByTheNumbers />
      <AnatomyOfCard />
      <EditorialPrinciples />
      <PartnershipUseCases />
      <PartnershipAsk />
      <Credibility />
      <PressKit />
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/BrandBook.jsx
git commit -m "feat(brand): mount all 11 chapters in BrandBook"
```

---

## Task 23: Add `print.css` stub

**Files:**
- Create: `src/pages/brand/print.css`

Phase-2 entry point. The selectors hide app chrome and set page size; full PDF flow rules come in phase 2.

- [ ] **Step 1: Implement**

Create `src/pages/brand/print.css`:

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  /* Hide app chrome that shouldn't appear in the PDF.
     Toaster portals, nav, etc. The brand book route does not render the app shell, but this is defensive. */
  body > div[role="status"],
  body > nav,
  body > header,
  body > footer {
    display: none !important;
  }
  [data-testid="brand-book"] section {
    page-break-inside: avoid;
  }
  /* Each chapter Plate / Spread starts a new page. Phase 2 may refine. */
  [data-testid="brand-book"] > * {
    page-break-after: always;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/brand/print.css
git commit -m "feat(brand): add print.css stub for phase 2"
```

---

## Task 24: Integration smoke test

**Files:**
- Create: `src/pages/brand/BrandBook.test.jsx`

Verifies the full route renders, all 11 chapter sub-anchors exist, all 4 stubs visibly carry `[FILL]`, and `lang="mn"` / `lang="en"` attributes are present.

- [ ] **Step 1: Write the test**

Create `src/pages/brand/BrandBook.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BrandBook from './BrandBook';

describe('BrandBook integration', () => {
  it('renders the book root', () => {
    render(<BrandBook />);
    expect(screen.getByTestId('brand-book')).toBeTruthy();
  });

  it('mounts all 11 chapter anchors', () => {
    const { container } = render(<BrandBook />);
    const expected = [
      'cover',
      'mission',
      'the-52',
      'product-experience',
      'by-the-numbers',
      'anatomy',
      'editorial-principles',
      'partnership-use-cases',
      'partnership-ask',
      'credibility',
      'press-kit',
    ];
    for (const id of expected) {
      const el = container.querySelector(`#${id}`);
      expect(el, `expected #${id} to be in the document`).toBeTruthy();
    }
  });

  it('shows [FILL] markers in every stub chapter', () => {
    const { container } = render(<BrandBook />);
    const stubs = ['by-the-numbers', 'editorial-principles', 'partnership-use-cases', 'credibility'];
    for (const id of stubs) {
      const section = container.querySelector(`#${id}`);
      expect(section, id).toBeTruthy();
      expect(within(section).getAllByText(/\[FILL\]/).length).toBeGreaterThan(0);
    }
  });

  it('does not show [FILL] in any built chapter', () => {
    const { container } = render(<BrandBook />);
    const built = ['cover', 'mission', 'the-52', 'product-experience', 'anatomy', 'partnership-ask', 'press-kit'];
    for (const id of built) {
      const section = container.querySelector(`#${id}`);
      expect(section, id).toBeTruthy();
      expect(within(section).queryAllByText(/\[FILL\]/).length).toBe(0);
    }
  });

  it('marks Mongolian and English content with lang attributes', () => {
    const { container } = render(<BrandBook />);
    expect(container.querySelectorAll('[lang="mn"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[lang="en"]').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, expect pass**

Run: `npx vitest run src/pages/brand/BrandBook.test.jsx`
Expected: 5 passed.

- [ ] **Step 3: Run the full vitest suite to verify no regression elsewhere**

Run: `npx vitest run`
Expected: previous suite passes + the new tests; no regression.

- [ ] **Step 4: Final manual smoke**

Run: `npm run dev`
Visit `http://localhost:5173/v2/brand`
Walk the page top-to-bottom. Verify:
- Cover renders with brass-circle wordmark
- Each chapter has a dark plate opener with chapter number + Mongolian title
- Stub chapters visibly carry the orange `[FILL] STUB` badge
- Partnership Ask shows 9 named asks
- Press Kit shows the contact line
- No console errors

Then visit `http://localhost:5173/v2/brand#partnership-ask` and verify the page jumps to that chapter.

- [ ] **Step 5: Commit**

```bash
git add src/pages/brand/BrandBook.test.jsx
git commit -m "test(brand): integration smoke for /brand route"
```

---

## Self-review checks performed

- **Spec coverage:** Every chapter in spec §3.4 has a task (Tasks 11–21). Every primitive in §3.1 has a task (Tasks 4–10). The route registration (§3.2) is Task 1. The `[FILL]` test assertion from §4 is Task 24 step 1. Phase-2 PDF (§5) is explicitly deferred — `print.css` stub exists (Task 23). Open content questions (§6) are intentionally deferred via stubs.
- **No placeholders:** All steps contain runnable code or runnable commands. No "TBD" or "similar to Task N" — every chapter has its full implementation shown even when components share a pattern.
- **Type/name consistency:** `parseChapter` exported from `parseChapter.js`, imported by every chapter. `Plate`, `Spread`, `EditorialBody`, `Specimen`, `PullQuote`, `MarginNote`, `BrassRule` exported as defaults from `primitives/`. Markdown section names (`STATUS`, `MN`, `EN`, `CALLOUTS`, `ASK`, etc.) are referenced consistently across `parseChapter.test.js`, the `.md` files, and the chapter components.
- **Stub honesty:** `[FILL]` literal exists in stub markdown bodies AND a visible badge in the rendered stub chapters; the integration test asserts both presence in stubs and absence in built chapters.

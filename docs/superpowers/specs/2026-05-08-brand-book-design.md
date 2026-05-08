# Brand Book — Altan Domog (Алтан Домог)

**Context:** Build a partner/sponsor/press-facing brand book for Altan Domog ("Golden Legend"), the Mongolian Historical Codex app. Existing visual identity is the "Codex" Stitch v2 palette (ink/ivory/brass/bronze/seal-red) with Inter Tight + Inter + IBM Plex Mono + Noto Serif Mongolian. The brand book documents what already exists, organized as a **conversion document** that turns reader interest into partnership conversations — not a design tokens reference.

The book is **Mongolian primary with English summaries**, ~24 pages, designed in Figma (out of repo) with a **web prototype** built inside this repo at `/v2/brand` that mirrors the layout. The web prototype is the v1 deliverable, namespaced under `/v2` to match the existing v2 routing convention (`/v2`, `/v2/app`). PDF generation is phase 2.

This spec was reviewed by Codex (independent, via three-brain) on 2026-05-08; the chapter outline below incorporates that review (added Partnership Ask, Credibility, Product Experience, By-the-Numbers chapters; reordered for partner logic; renamed "Applications" → "Partnership Use Cases"; revised voice positioning).

## 1. Scope

**In scope (v1 — web prototype)**
- New route `/v2/brand` in the existing React/Vite app, lazy-loaded. Sibling of `/v2` and `/v2/app`.
- New folder `docs/brand-book/` with one markdown file per chapter holding Mongolian copy + English summary + layout notes (designer-readable, auditable, single source of truth for content).
- New folder `src/pages/brand/` with one `BrandBook.jsx` entry, one chapter component per chapter, and a small `primitives/` set: `Spread`, `Plate`, `EditorialBody`, `Specimen`, `PullQuote`, `MarginNote`, `BrassRule`.
- Reuses existing Codex tokens (`--ink`, `--ivory`, `--brass`, `--bronze`, `--seal`, `--lapis`, `--steppe`) and font CSS variables. No new design system, no new color tokens.
- Three repeating spread types: **A** full-bleed plate (chapter openers), **B** editorial body (two-column asymmetric), **C** specimen (anatomy / system pages).
- Seven chapters fully built in v1 (see §3.4): Cover, Mission, The 52, Product Experience, Anatomy of a Card, Partnership Ask, Press Kit + Colophon.
- Four chapters stubbed in v1 (layout shell + `[FILL]` placeholder copy): By the Numbers, Editorial Principles, Partnership Use Cases, Credibility & Stewardship.
- Sub-anchor URLs under `/v2/brand` (`#cover`, `#mission`, `#the-52`, `#product-experience`, `#anatomy`, `#by-the-numbers`, `#editorial-principles`, `#partnership-use-cases`, `#partnership-ask`, `#credibility`, `#press-kit`) for direct linking from emails and proposals.
- Print stylesheet stub `src/pages/brand/print.css` — declares `@page A4 portrait`, hides the main app chrome, but full PDF rendering is phase 2.
- Tests: smoke render of `/brand`, snapshot of each primitive, accessibility (`alt` on plate images, semantic headings, language attributes `lang="mn"` and `lang="en"` on the right blocks).

**Out of scope (v1)**
- Figma file itself. Designer executes Figma against the web prototype and the markdown spec; not a Claude deliverable.
- PDF generation (`scripts/render-pdf.js` via Puppeteer + the `npm run build:brand-pdf` command). **Phase 2.**
- Real plate imagery. v1 uses **black plates with a single line of brass mono copy** (e.g. "PLATE I — Чингис хааны эрин" — no portrait yet) as a respectful placeholder. If figure portraits already exist in `public/figures/` they may be reused, but commissioning new plate art is out of scope.
- Figure-level content sourcing (we do not write copy for any of the 52 figures — they live in the existing app data, not in the brand book).
- Real metrics for "By the Numbers" — this chapter ships with placeholder counts and a `[FILL]` flag; numbers come from the user.
- Real team / advisor list for "Credibility & Stewardship" — same pattern.
- Marketing site changes outside `/brand`. The main landing page is untouched.
- Internationalization beyond Mongolian + English. No Russian, Chinese, or traditional vertical Mongolian (Mongol bichig) script in body content. The existing `--font-bichig` CSS variable (currently mapped to Noto Serif Mongolian) remains available for ornamental wordmarks if a designer wants it, but the body language pair is mn + en.

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Audience is **external partners, sponsors, press** — not internal team and not end users. | User selected. Drives every other decision: voice, page count, Partnership Ask chapter. |
| 2 | **Mongolian primary, English summary** at the close of each chapter (and inline in two-column body spreads). | User selected. Signals cultural ownership; English makes the book usable for international media, museums, donors, diaspora. |
| 3 | **Figma-first, web prototype mirrors it.** Web prototype is the v1 Claude deliverable; Figma is executed by a designer against the prototype + spec. | User selected approach B with the "spec + content + web prototype" sub-option. |
| 4 | **24 pages**, ~10 chapters. | Codex review: long enough to feel serious, short enough to read before a meeting. Original 21-page outline grew by 3 to accommodate Partnership Ask + Credibility + restructured Product Experience. |
| 5 | **Reuses existing Codex tokens** — no new color or font additions. | The brand exists; the book documents it. Adding new tokens would create drift. |
| 6 | **Voice: "dignified, evidence-led, accessible, culturally rooted."** Replaces the earlier "reverent but never mythologizing" framing. | Codex flagged the original as defensive; new framing is positive and partnership-friendly. |
| 7 | **"The 52" chapter early** (chapter 2, before the visual system). | The deck is the symbolic core; partners need to grasp it before they care about ornament. |
| 8 | **"Anatomy of a Card" tightened to 3 pages** (down from initial 5). | Codex review: 5 pages reads as internal design manual, not external pitch. |
| 9 | **"Applications" renamed → "Partnership Use Cases,"** organized by partner scenario (ministry, museum, school, sponsor, press). | Same content, more fundable framing. |
| 10 | **Partnership Ask is its own one-page chapter** with named asks (e.g. "Sponsor a figure set — ₮5M / 4 cards"). | Codex review: without this, the book inspires but does not convert. |
| 11 | **Founder's voice compressed to 1 page max** within Mission. | Codex: external partners care about credibility and stewardship more than origin story. |
| 12 | **Web prototype lives at `/v2/brand` inside the existing repo**, namespaced under v2. | Single source of truth, reuses every existing token, edits flow into the product. Sibling of `/v2` (LandingV2) and `/v2/app` (HomeV2). |
| 13 | **Three spread types only** (Plate, EditorialBody, Specimen). | Pacing rhythm of Phaidon/Rizzoli monographs. More variation muddies the book. |
| 14 | **Plate imagery is black-with-brass-mono in v1**, not real portraits. | Real plate art is out of scope; placeholders are honest and respectful. |
| 15 | **Content is markdown in `docs/brand-book/`**, rendered by chapter components. | Designer-readable; auditable; same content drives Figma execution and the React prototype. |
| 16 | **PDF is phase 2.** Web URL is the v1 sponsor-shareable artifact. | Modern partners accept URLs. PDF adds Puppeteer dependency we don't need yet. |

## 3. Architecture

### 3.1 File layout

```
docs/brand-book/                       — NEW
├── README.md                            index, how to edit, design rationale
├── 00-cover.md
├── 01-mission.md
├── 02-the-52.md
├── 03-product-experience.md
├── 04-by-the-numbers.md                 [stubbed in v1]
├── 05-anatomy-of-card.md
├── 06-editorial-principles.md           [stubbed in v1]
├── 07-partnership-use-cases.md          [stubbed in v1]
├── 08-partnership-ask.md
├── 09-credibility.md                    [stubbed in v1]
└── 10-press-kit.md

src/pages/brand/                       — NEW
├── BrandBook.jsx                        the /brand route, mounts chapters in order
├── print.css                            @page A4 stub for phase 2
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
└── primitives/
    ├── Spread.jsx                       full-bleed two-page composition wrapper
    ├── Plate.jsx                        full-bleed image plate (Type A)
    ├── EditorialBody.jsx                two-column asymmetric body (Type B)
    ├── Specimen.jsx                     specimen page with callouts (Type C)
    ├── PullQuote.jsx                    large brass pull quote
    ├── MarginNote.jsx                   small mono brass margin note
    └── BrassRule.jsx                    hairline rule for specimen callouts

src/App.jsx                            — MODIFIED (one new lazy route)
```

### 3.2 Routing

- `/v2/brand` — namespaced under v2, **not** linked from the main app navigation. Direct-link only (sponsors get the URL via email).
- Sub-anchors per chapter (`/v2/brand#mission`, `/v2/brand#partnership-ask`, etc.) for deep linking.
- Lazy-loaded via `React.lazy` so the chapter components and any large markdown imports don't bloat the main app bundle.
- The route is **not gated** by auth or invite code — the brand book is intentionally public so it can be shared.

### 3.3 Spread types

| Type | Used for | Composition |
|---|---|---|
| **A — Plate** | Chapter openers (×11) | Full-bleed dark ground, edge-to-edge. Chapter number in brass IBM Plex Mono lower-left; chapter title in Noto Serif Mongolian centered along the bottom seal-strip. No copy. |
| **B — Editorial body** | Mission, Editorial Principles, Credibility, Partnership Ask | Two-column asymmetric grid: Mongolian copy in 11/16pt Inter (or Noto Serif Mongolian for headings) on the wider left column, English summary in 9/13pt italic in the narrower right column. Margin notes (figure dates, sources) in IBM Plex Mono brass. |
| **C — Specimen** | Anatomy of a Card, By the Numbers, Product Experience | Single hero card or app screen anchors the page; numbered callouts radiate outward via hairline brass rules; small mono-spaced labels on each callout (6 words max). |

### 3.4 v1 build vs. stub matrix

| # | Chapter | Pages | v1 status | Why |
|---|---|---|---|---|
| — | Cover / Frontispiece | 2 | **Built** | Trivial; high-leverage first impression. |
| 1 | Mission & origin | 2 | **Built** | We have enough context to draft Mongolian + English copy without user input. |
| 2 | The 52 | 3 | **Built** | Reuses existing figure-grouping data from the app. |
| 3 | Product experience | 3 | **Built** | Reuses existing app screens / features list. |
| 4 | By the numbers + impact | 2 | **Stub** | Needs real metrics from user (DAU, schools reached, etc.). Layout shell + `[FILL]` flags. |
| 5 | Anatomy of a card | 3 | **Built** | Reuses existing card component anatomy from the app. |
| 6 | Editorial principles | 2 | **Stub** | Needs user input on figure-selection process and how sensitive histories are handled. |
| 7 | Partnership use cases | 3 | **Stub** | Needs real partner scenarios (which ministries / museums / schools are actually in conversation). |
| 8 | Partnership ask | 1 | **Built** | We can draft a credible default ask list (sponsor a figure set, school access, QR installations, etc.); user edits before sending. |
| 9 | Credibility & stewardship | 1 | **Stub** | Needs the actual team / advisor list from the user. |
| — | Press kit + colophon | 2 | **Built** | Approved short description, lockups, screenshots, contact — composable from existing assets. |

Stubbed chapters render with the correct layout, the correct heading hierarchy, and clearly-marked `[FILL]` placeholder copy in both Mongolian and English. They are never silently empty.

### 3.5 Pacing principle

`Plate → body → body → specimen → plate → body → ask → close.`

Every fourth page is silence (a Plate). This is the cadence of art-history monographs (Phaidon, Rizzoli). The eye never tires; the reader keeps turning.

### 3.6 Voice

**Positioning:** dignified, evidence-led, accessible, culturally rooted.

**Mongolian:** authoritative without being stiff. Avoid both academic distance and folkloric exaggeration. Quote primary sources (《Mongolyn Nuuts Tovchoo》, 《Sudar bichig》, etc.) where appropriate; mark uncertainty explicitly when sources disagree.

**English:** summary register, never marketing-speak. The English block is for media briefings and partnership conversations, not advertising.

**Forbidden:** "ancient," "warrior," "fierce," "savage," "wild" — the orientalist register. We do not flatter the reader's exoticism; we educate.

**Required:** dates, names spelled in both Cyrillic and traditional script (where the figure has both forms), source notes when claims are non-trivial.

## 4. Test plan

- **Smoke:** `/brand` renders without error; all 11 chapter components mount; `lang="mn"` and `lang="en"` attributes are on the correct text blocks; `alt` text on every Plate image (even the placeholder dark plates).
- **Primitives:** snapshot test for each of `Spread`, `Plate`, `EditorialBody`, `Specimen`, `PullQuote`, `MarginNote`, `BrassRule` rendering with realistic props.
- **Stub flags:** test asserts that stubbed chapters contain the literal string `[FILL]` somewhere — this is intentional, so the test prevents accidental "stub looks done."
- **Anchors:** clicking a chapter title in a tiny in-page TOC scrolls to the right section (one smoke test).
- **Accessibility:** `axe` rule pass on the rendered route; semantic h1/h2 hierarchy correct; landmarks set; sufficient contrast (Codex tokens already meet WCAG AA on ink/ivory but worth verifying on brass-on-ink for chapter numerals).
- **No bundle-size regression:** `/brand` is lazy-loaded; main bundle's gzipped size doesn't increase by more than a small constant (the route registration itself).

## 5. Phase 2 — PDF export (deferred)

Adds, in a future plan:
- `src/pages/brand/print.css` filled out with proper A4 portrait flow, page-break rules, and chapter-opener `page-break-before: always`.
- `scripts/render-pdf.js` using Puppeteer that hits `localhost:5173/brand?print=1`, waits for fonts to load, prints to `dist/altan-domog-brand-book.pdf`.
- `npm run build:brand-pdf` script.
- A "Download PDF" link in the cover spread that becomes live when the PDF artifact exists.

## 6. Open content questions

These are not blockers for v1 but the user should answer them before the **stubbed** chapters move from `[FILL]` to shipped:

1. **Real metrics** for "By the Numbers" — total figures (52 confirmed), ~total story chapters, ~quote-game rounds played, ~schools/users reached, languages supported.
2. **Figure-selection process** — how were the 52 chosen, who reviewed, how is the list maintained or contested?
3. **Real partner conversations** in progress — for Partnership Use Cases to be specific, not generic.
4. **Team & advisors** — names, roles, affiliations, photos? Even one founder + 2 advisors is enough; ministries especially won't move without governance signals.
5. **Sensitive-history handling** — figures with disputed legacies (e.g., Genghis-era conquests, 20th-century political figures): is there an editorial board, an external review process, or is this a known governance gap?

The spec ships with sensible defaults and `[FILL]` flags. The user provides the answers when they're ready, and the stubbed chapters get filled.

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

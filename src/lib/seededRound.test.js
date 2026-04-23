import { describe, it, expect } from 'vitest';
import { buildRoundFromSeed, hashSeed, mulberry32 } from '@/lib/seededRound';

// Matches real figuresData.js shape: single-language fields, plural `cat`.
const FIXTURE_FIGURES = [
  { fig_id: 1, cat: 'khans',    name: 'Chinggis', quote: 'q1', qattr: 'Chinggis' },
  { fig_id: 2, cat: 'khans',    name: 'Ogedei',   quote: 'q2', qattr: 'Ogedei'   },
  { fig_id: 3, cat: 'khans',    name: 'Kublai',   quote: 'q3', qattr: 'Kublai'   },
  { fig_id: 4, cat: 'khans',    name: 'Mongke',   quote: 'q4', qattr: 'Mongke'   },
  { fig_id: 5, cat: 'khans',    name: 'Tolui',    quote: 'q5', qattr: 'Tolui'    },
  { fig_id: 6, cat: 'warriors', name: 'Subutai',  quote: 'q6', qattr: 'Subutai'  },
  { fig_id: 7, cat: 'warriors', name: 'Jebe',     quote: 'q7', qattr: 'Jebe'     },
];

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });
});

describe('hashSeed', () => {
  it('returns a 32-bit integer', () => {
    const h = hashSeed('GQ7K4R2A9M');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('is deterministic for the same input', () => {
    expect(hashSeed('ABC')).toBe(hashSeed('ABC'));
  });
});

describe('buildRoundFromSeed', () => {
  it('produces byte-identical output for the same (figures, size, seed)', () => {
    const r1 = buildRoundFromSeed(FIXTURE_FIGURES, 3, 'SEED001');
    const r2 = buildRoundFromSeed(FIXTURE_FIGURES, 3, 'SEED001');
    expect(r1).toEqual(r2);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('produces a different round for a different seed', () => {
    const r1 = buildRoundFromSeed(FIXTURE_FIGURES, 3, 'SEED001');
    const r2 = buildRoundFromSeed(FIXTURE_FIGURES, 3, 'SEED002');
    expect(r1).not.toEqual(r2);
  });

  it('respects round size (capped at pool size)', () => {
    const r = buildRoundFromSeed(FIXTURE_FIGURES, 5, 'SEED001');
    expect(r).toHaveLength(5);
    expect(new Set(r.map((q) => q.figId)).size).toBe(5);
  });

  it('each question has 4 unique option fig_ids including the correct one', () => {
    const r = buildRoundFromSeed(FIXTURE_FIGURES, 3, 'SEED001');
    for (const q of r) {
      expect(q.optionFigIds).toHaveLength(4);
      expect(q.optionFigIds).toContain(q.figId);
      expect(new Set(q.optionFigIds).size).toBe(4);
    }
  });

  it('skips figures without a quote', () => {
    const figs = [
      ...FIXTURE_FIGURES,
      { fig_id: 99, cat: 'khans', name: 'Mute' }, // no quote
    ];
    const r = buildRoundFromSeed(figs, 10, 'SEED001');
    expect(r.every((q) => q.figId !== 99)).toBe(true);
  });

  it('carries the Mongolian quote text through unchanged', () => {
    const r = buildRoundFromSeed(FIXTURE_FIGURES, 3, 'SEED042');
    for (const q of r) {
      const src = FIXTURE_FIGURES.find((f) => f.fig_id === q.figId);
      expect(q.quote).toBe(src.quote);
      expect(q.qattr).toBe(src.qattr);
    }
  });
});

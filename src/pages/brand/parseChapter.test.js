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

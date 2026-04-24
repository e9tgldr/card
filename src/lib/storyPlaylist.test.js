import { describe, it, expect } from 'vitest';
import { buildChapterPlaylist, nextEra, ACTS } from '@/lib/storyPlaylist';
import { ERA_KEYS } from '@/lib/figuresData';

describe('buildChapterPlaylist', () => {
  it('returns [intro, ...figures, outro] in fig_id order', () => {
    const pl = buildChapterPlaylist('founding');
    expect(pl[0].kind).toBe('intro');
    expect(pl[0].era).toBe('founding');
    expect(pl[pl.length - 1].kind).toBe('outro');
    const ids = pl.filter((s) => s.kind === 'figure').map((s) => s.figure.fig_id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('returns [intro, outro] for unknown era', () => {
    const pl = buildChapterPlaylist('__nope__');
    expect(pl).toHaveLength(2);
    expect(pl[0].kind).toBe('intro');
    expect(pl[1].kind).toBe('outro');
  });

  it('applies act labels from ACTS when present', () => {
    const pl = buildChapterPlaylist('founding');
    const chinggis = pl.find((s) => s.kind === 'figure' && s.figure.fig_id === 1);
    expect(chinggis.act).toBeTruthy();
  });
});

describe('nextEra', () => {
  it('returns the next era key', () => {
    expect(nextEra('founding')).toBe('expansion');
  });
  it('returns null past the last era', () => {
    expect(nextEra(ERA_KEYS[ERA_KEYS.length - 1])).toBeNull();
  });
});

describe('ACTS', () => {
  it('has an entry for each era key', () => {
    for (const key of ERA_KEYS) expect(ACTS[key]).toBeDefined();
  });
});

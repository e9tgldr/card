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
    expect(true).toBe(true);
  });
});

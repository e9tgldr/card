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

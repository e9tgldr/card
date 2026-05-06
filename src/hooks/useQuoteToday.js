import { useMemo } from 'react';
import { FIGURES } from '@/lib/figuresData';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Pick a quote-of-the-day deterministically from FIGURES that have a
 * non-empty `quote` field. Same UTC day → same quote everywhere.
 *
 * Decoupled from useFeaturedToday because only ~half the figures have
 * quotes — binding the daily quote to today's portrait would leave the
 * quote area empty on the other days.
 *
 * Returns { quote, attr, fig_id, yrs } or null if pool is empty.
 */
export function useQuoteToday() {
  return useMemo(() => {
    const eligible = FIGURES.filter((f) => f.quote);
    if (eligible.length === 0) return null;
    const dayIndex = Math.floor(Date.now() / DAY_MS);
    const f = eligible[dayIndex % eligible.length];
    return { quote: f.quote, attr: f.qattr ?? f.name, fig_id: f.fig_id, yrs: f.yrs };
  }, []);
}

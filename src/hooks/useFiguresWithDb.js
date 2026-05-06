import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FIGURES } from '@/lib/figuresData';
import { base44 } from '@/api/base44Client';

/**
 * Fetches the public.figures DB rows and merges them on top of the
 * in-memory FIGURES constant, keyed by `fig_id`. Null-valued DB columns
 * never override the constant — so a row that was created just to land
 * a single admin-uploaded `front_img` won't blank out its `name` etc.
 *
 * Returns the merged array sorted by fig_id. If the DB fetch hasn't
 * landed yet, returns FIGURES so the UI never sees an empty grid.
 */
export function useFiguresWithDb() {
  const { data: dbFigures } = useQuery({
    queryKey: ['figures'],
    queryFn: () => base44.entities.Figure.list('-fig_id', 100),
    initialData: [],
    staleTime: 30 * 1000,
  });

  return useMemo(() => {
    if (!dbFigures || dbFigures.length === 0) return FIGURES;
    const byFigId = new Map(dbFigures.map((d) => [d.fig_id, d]));
    const merged = FIGURES.map((defaultFig) => {
      const dbFig = byFigId.get(defaultFig.fig_id);
      if (!dbFig) return defaultFig;
      const overrides = Object.fromEntries(
        Object.entries(dbFig).filter(([, v]) => v != null)
      );
      return { ...defaultFig, ...overrides };
    });
    dbFigures.forEach((dbFig) => {
      if (!merged.find((m) => m.fig_id === dbFig.fig_id)) merged.push(dbFig);
    });
    merged.sort((a, b) => a.fig_id - b.fig_id);
    return merged;
  }, [dbFigures]);
}

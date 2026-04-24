import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Fetch figure_voices for `lang` once per session. Returns:
 *   { isLoading, voiceIdFor(figId): string | null }
 */
export function useVoices(lang) {
  const query = useQuery({
    queryKey: ['figure_voices', lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('figure_voices')
        .select('fig_id, voice_id')
        .eq('lang', lang);
      if (error) throw error;
      const map = new Map();
      for (const row of data ?? []) map.set(row.fig_id, row.voice_id);
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const voiceIdFor = (figId) => {
    if (!query.data) return null;
    return query.data.get(figId) ?? null;
  };

  return { isLoading: query.isLoading, voiceIdFor };
}

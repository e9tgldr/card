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

/**
 * Fetch all-language figure_voices rows for a single figure. Returns
 *   { isLoading, voiceIdForLang(lang): string | null }
 *
 * Use when the active language can change per-message (e.g. ScanChat's per-
 * message 🔊 button replaying old AI replies in their original lang).
 */
export function useFigureVoices(figId) {
  const query = useQuery({
    queryKey: ['figure_voices', 'fig', figId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('figure_voices')
        .select('lang, voice_id')
        .eq('fig_id', figId);
      if (error) throw error;
      const map = new Map();
      for (const row of data ?? []) map.set(row.lang, row.voice_id);
      return map;
    },
    staleTime: 5 * 60 * 1000,
    enabled: figId != null,
  });

  const voiceIdForLang = (lang) => query.data?.get(lang) ?? null;
  return { isLoading: query.isLoading, voiceIdForLang };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Fetch all story_content rows once per session.
 * Returns { isLoading, get(slug, lang): { text, status } | null }.
 * When `isPreview` is false, drafts are ignored (get returns null for them).
 * When `isPreview` is true, drafts surface alongside published rows.
 * RLS already filters draft rows for non-admins regardless of this flag.
 */
export function useAuthoredContent(isPreview = false) {
  const query = useQuery({
    queryKey: ['story_content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_content')
        .select('slug, lang, text, status');
      if (error) throw error;
      const map = new Map();
      for (const row of data ?? []) {
        map.set(`${row.slug}|${row.lang}`, { text: row.text, status: row.status });
      }
      return map;
    },
    staleTime: 2 * 60 * 1000,
  });

  const get = (slug, lang) => {
    if (!query.data) return null;
    const hit = query.data.get(`${slug}|${lang}`);
    if (!hit) return null;
    if (hit.status === 'published') return hit;
    if (isPreview) return hit;
    return null;
  };

  return { isLoading: query.isLoading, get };
}

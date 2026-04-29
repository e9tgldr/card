import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const BUCKET = 'figure-videos';

function publicUrl(path) {
  if (!path) return null;
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export function useFigureARPack() {
  const query = useQuery({
    queryKey: ['figure_ar_pack'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('figure_ar_pack')
        .select('pack_path, target_order')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const row = query.data;
  return {
    packUrl: publicUrl(row?.pack_path),
    targetOrder: row?.target_order ?? null,
    ready: !!row?.pack_path && Array.isArray(row?.target_order) && row.target_order.length > 0,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}

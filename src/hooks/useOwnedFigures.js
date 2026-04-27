import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useOwnedFigures(userId) {
  const [figIds, setFigIds] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setFigIds([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('card_ownership')
      .select('fig_id')
      .eq('user_id', userId)
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr);
          setFigIds([]);
        } else {
          setError(null);
          setFigIds((data ?? []).map((r) => r.fig_id));
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`card_ownership:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'card_ownership', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newFigId = payload?.new?.fig_id;
          if (typeof newFigId !== 'number') return;
          setFigIds((prev) => (prev.includes(newFigId) ? prev : [...prev, newFigId]));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { figIds, loading, error };
}

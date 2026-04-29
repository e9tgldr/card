import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...a) => mockFrom(...a) },
}));

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');

import { useFigureARPack } from '@/hooks/useFigureARPack';

function row(packPath, targetOrder) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: packPath == null ? null : { pack_path: packPath, target_order: targetOrder },
            error: null,
          }),
      }),
    }),
  };
}

function wrap({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => mockFrom.mockReset());

describe('useFigureARPack', () => {
  it('returns ready=true with packUrl + targetOrder when row present', async () => {
    mockFrom.mockReturnValue(row('pack/ar-1.mind', [1, 2, 3]));
    const { result } = renderHook(() => useFigureARPack(), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    expect(result.current.packUrl).toBe(
      'https://example.supabase.co/storage/v1/object/public/figure-videos/pack/ar-1.mind',
    );
    expect(result.current.targetOrder).toEqual([1, 2, 3]);
  });

  it('returns ready=false when no row', async () => {
    mockFrom.mockReturnValue(row(null));
    const { result } = renderHook(() => useFigureARPack(), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    expect(result.current.packUrl).toBeNull();
  });

  it('returns ready=false when target_order is empty array', async () => {
    mockFrom.mockReturnValue(row('pack/ar-1.mind', []));
    const { result } = renderHook(() => useFigureARPack(), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
  });
});

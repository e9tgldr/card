import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVoices } from '@/hooks/useVoices';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

function wrap(client) {
  // eslint-disable-next-line react/display-name
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => { mockFrom.mockReset(); });

describe('useVoices', () => {
  it('returns voiceIdFor that maps figId -> voice_id for the active lang', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [
            { fig_id: 1, lang: 'mn', voice_id: 'vid_A' },
            { fig_id: 3, lang: 'mn', voice_id: 'vid_B' },
          ],
          error: null,
        }),
      }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useVoices('mn'), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.voiceIdFor(1)).toBe('vid_A');
    expect(result.current.voiceIdFor(3)).toBe('vid_B');
    expect(result.current.voiceIdFor(99)).toBeNull();
  });

  it('returns null on query error', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('boom') }),
      }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useVoices('mn'), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.voiceIdFor(1)).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthoredContent } from '@/hooks/useAuthoredContent';

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

describe('useAuthoredContent', () => {
  it('returns a getter that finds published rows by slug+lang', async () => {
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({
        data: [
          { slug: 'figure:1',           lang: 'mn', text: 'Story A', status: 'published' },
          { slug: 'figure:1',           lang: 'en', text: 'Draft',   status: 'draft' },
          { slug: 'era_intro:founding', lang: 'mn', text: 'Opening', status: 'published' },
        ],
        error: null,
      }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuthoredContent(false), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.get('figure:1', 'mn')).toEqual({ text: 'Story A', status: 'published' });
    expect(result.current.get('figure:1', 'en')).toBeNull();
    expect(result.current.get('era_intro:founding', 'mn')?.text).toBe('Opening');
    expect(result.current.get('figure:999', 'mn')).toBeNull();
  });

  it('surfaces drafts when preview=true', async () => {
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({
        data: [{ slug: 'figure:2', lang: 'mn', text: 'WIP', status: 'draft' }],
        error: null,
      }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuthoredContent(true), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.get('figure:2', 'mn')?.text).toBe('WIP');
  });

  it('returns null getter on query error', async () => {
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({ data: null, error: new Error('boom') }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuthoredContent(false), { wrapper: wrap(client) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.get('figure:1', 'mn')).toBeNull();
  });
});

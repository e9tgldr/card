import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOwnedFigures } from '@/hooks/useOwnedFigures';

const mockFrom = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();
const subscribeCallbacks = [];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockChannel.mockReset();
  mockRemoveChannel.mockReset();
  subscribeCallbacks.length = 0;
  mockChannel.mockImplementation(() => {
    const ch = {
      on: vi.fn().mockImplementation((_evt, _filter, cb) => {
        subscribeCallbacks.push(cb);
        return ch;
      }),
      subscribe: vi.fn().mockImplementation(() => ch),
    };
    return ch;
  });
});

describe('useOwnedFigures', () => {
  it('returns figIds from initial fetch', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [{ fig_id: 1 }, { fig_id: 3 }, { fig_id: 14 }],
          error: null,
        }),
      }),
    });

    const { result } = renderHook(() => useOwnedFigures('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.figIds).toEqual([1, 3, 14]);
    expect(result.current.error).toBeNull();
  });

  it('appends figIds when Realtime delivers an INSERT', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ fig_id: 1 }], error: null }),
      }),
    });
    const { result } = renderHook(() => useOwnedFigures('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.figIds).toEqual([1]);

    act(() => {
      subscribeCallbacks[0]({ new: { fig_id: 7, user_id: 'user-1' } });
    });
    expect(result.current.figIds).toEqual([1, 7]);
  });

  it('returns empty array and error on fetch failure', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('boom') }),
      }),
    });
    const { result } = renderHook(() => useOwnedFigures('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.figIds).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('returns empty figIds without fetching when userId is null', async () => {
    const { result } = renderHook(() => useOwnedFigures(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.figIds).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

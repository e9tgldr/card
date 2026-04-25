import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  submitResult,
  fetchSession,
  fetchSessionResults,
  fetchLeaderboard,
  fetchMyLeaderboardRank,
} from '@/lib/gameApi';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSession', () => {
  it('invokes the Edge Function with the given payload', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, id: 's1', seed: 'SEED001', join_code: null, share_path: null },
      error: null,
    });
    const res = await createSession({ mode: 'solo', lang: 'mn', round_size: 10 });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('game-create-session', {
      body: { mode: 'solo', lang: 'mn', round_size: 10 },
    });
    expect(res).toEqual({ id: 's1', seed: 'SEED001', join_code: null, share_path: null });
  });

  it('throws when the function returns ok:false', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: false, reason: 'bad_lang' },
      error: null,
    });
    await expect(createSession({ mode: 'solo', lang: 'xx' })).rejects.toThrow('bad_lang');
  });

  it('passes optional fields only when provided', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, id: 's2', seed: 'S2', join_code: null, share_path: '/duel/s2' },
      error: null,
    });
    await createSession({ mode: 'async_duel', lang: 'en', round_size: 10, from_session_id: 'prev' });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('game-create-session', {
      body: { mode: 'async_duel', lang: 'en', round_size: 10, from_session_id: 'prev' },
    });
  });
});

describe('submitResult', () => {
  it('posts answers and returns the score', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, score: 7, total: 10, correct_fig_ids: [1, 2] },
      error: null,
    });
    const res = await submitResult({
      session_id: 's1',
      answers: [{ idx: 0, pickedFigId: 1, ms: 2500 }],
    });
    expect(res).toEqual({ score: 7, total: 10, correct_fig_ids: [1, 2] });
  });
});

describe('fetchSession', () => {
  it('queries game_sessions by id', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 's1', seed: 'S' }, error: null });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ select });

    const res = await fetchSession('s1');
    expect(supabase.from).toHaveBeenCalledWith('game_sessions');
    expect(eq).toHaveBeenCalledWith('id', 's1');
    expect(res).toEqual({ id: 's1', seed: 'S' });
  });
});

describe('fetchLeaderboard', () => {
  it('reads from the weekly view by default', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ username: 'a', total_points: 9 }],
      error: null,
    });
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));
    supabase.from.mockReturnValue({ select });

    const res = await fetchLeaderboard('weekly', 20);
    expect(supabase.from).toHaveBeenCalledWith('game_leaderboard_weekly');
    expect(order).toHaveBeenCalledWith('total_points', { ascending: false });
    expect(limit).toHaveBeenCalledWith(20);
    expect(res).toEqual([{ username: 'a', total_points: 9 }]);
  });

  it('reads from the all-time view when asked', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ limit }));
    supabase.from.mockReturnValue({ select: () => ({ order }) });

    await fetchLeaderboard('all_time', 20);
    expect(supabase.from).toHaveBeenCalledWith('game_leaderboard_all_time');
  });
});

describe('fetchSessionResults', () => {
  it('returns all results for a session', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        { user_id: 'u1', score: 8 },
        { user_id: 'u2', score: 6 },
      ],
      error: null,
    });
    supabase.from.mockReturnValue({ select: () => ({ eq }) });

    const res = await fetchSessionResults('s1');
    expect(eq).toHaveBeenCalledWith('session_id', 's1');
    expect(res).toHaveLength(2);
  });
});

describe('fetchMyLeaderboardRank', () => {
  function makeClient({ above, total, errAbove = null, errTotal = null }) {
    let callIdx = 0;
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => {
          // First .from(...).select(...) is for the 'above' query (chained .gt)
          // Second .from(...).select(...) is for the 'total' query (no .gt)
          if (callIdx === 0) {
            callIdx = 1;
            return {
              gt: vi.fn().mockResolvedValue({ count: above, error: errAbove }),
            };
          }
          // For the second call, the await is on the select's return — make it thenable
          callIdx = 0; // reset for safety
          return Promise.resolve({ count: total, error: errTotal });
        }),
      })),
    };
  }

  it('returns null when myPoints is null', async () => {
    const r = await fetchMyLeaderboardRank('weekly', null, makeClient({ above: 0, total: 0 }));
    expect(r).toBeNull();
  });

  it('returns null when myPoints is undefined', async () => {
    const r = await fetchMyLeaderboardRank('weekly', undefined, makeClient({ above: 0, total: 0 }));
    expect(r).toBeNull();
  });

  it('returns rank=1 when no one outscores you', async () => {
    const r = await fetchMyLeaderboardRank('weekly', 100, makeClient({ above: 0, total: 50 }));
    expect(r).toEqual({ rank: 1, total: 50 });
  });

  it('returns rank = aboveCount + 1', async () => {
    const r = await fetchMyLeaderboardRank('weekly', 100, makeClient({ above: 46, total: 200 }));
    expect(r).toEqual({ rank: 47, total: 200 });
  });

  it('uses all_time view when kind=all_time', async () => {
    const client = makeClient({ above: 5, total: 100 });
    const r = await fetchMyLeaderboardRank('all_time', 50, client);
    expect(r).toEqual({ rank: 6, total: 100 });
    expect(client.from).toHaveBeenCalledWith('game_leaderboard_all_time');
  });

  it('throws when above-query errors', async () => {
    const client = makeClient({ above: null, total: 0, errAbove: { message: 'nope' } });
    await expect(fetchMyLeaderboardRank('weekly', 100, client)).rejects.toThrow('nope');
  });
});

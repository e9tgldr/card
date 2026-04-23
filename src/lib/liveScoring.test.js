import { describe, it, expect } from 'vitest';
import { computeStandings, pickMvp } from '@/lib/liveScoring';

describe('computeStandings', () => {
  it('orders by correct count desc, then total ms asc', () => {
    const participants = [
      { user_id: 'A', username: 'alpha', answers: [{ correct: true, ms: 3000 }, { correct: true, ms: 2500 }] },
      { user_id: 'B', username: 'bravo', answers: [{ correct: true, ms: 1000 }, { correct: false, ms: 500 }] },
      { user_id: 'C', username: 'charlie', answers: [{ correct: true, ms: 2000 }, { correct: true, ms: 4000 }] },
    ];
    const standings = computeStandings(participants);
    expect(standings.map((s) => s.user_id)).toEqual(['A', 'C', 'B']);
    expect(standings[0]).toMatchObject({ user_id: 'A', correct: 2, total_ms: 5500 });
    expect(standings[2]).toMatchObject({ user_id: 'B', correct: 1 });
  });

  it('handles no answers (score 0, ms 0)', () => {
    const standings = computeStandings([
      { user_id: 'X', username: 'x', answers: [] },
    ]);
    expect(standings[0]).toMatchObject({ user_id: 'X', correct: 0, total_ms: 0 });
  });

  it('treats null pickedFigId (timeout) as wrong, ms still counts toward tiebreak', () => {
    const standings = computeStandings([
      { user_id: 'A', username: 'a', answers: [{ correct: false, ms: 15000, pickedFigId: null }] },
      { user_id: 'B', username: 'b', answers: [{ correct: false, ms: 14000, pickedFigId: 3 }] },
    ]);
    expect(standings.map((s) => s.user_id)).toEqual(['B', 'A']);
  });
});

describe('pickMvp', () => {
  it('returns top-1 user_id', () => {
    expect(pickMvp([{ user_id: 'A' }, { user_id: 'B' }])).toBe('A');
  });
  it('returns null for empty', () => {
    expect(pickMvp([])).toBeNull();
  });
});

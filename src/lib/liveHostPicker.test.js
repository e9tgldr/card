import { describe, it, expect } from 'vitest';
import { pickNextHost } from '@/lib/liveHostPicker';

describe('pickNextHost', () => {
  const participants = [
    { user_id: 'C', joined_at: '2026-04-24T00:00:02Z' },
    { user_id: 'A', joined_at: '2026-04-24T00:00:00Z' },
    { user_id: 'B', joined_at: '2026-04-24T00:00:01Z' },
  ];

  it('returns oldest-joined present participant', () => {
    expect(pickNextHost({ participants, present: { A: true, B: true, C: true } })).toBe('A');
  });

  it('skips absent participants', () => {
    expect(pickNextHost({ participants, present: { A: false, B: true, C: true } })).toBe('B');
  });

  it('returns null when nobody is present', () => {
    expect(pickNextHost({ participants, present: { A: false, B: false, C: false } })).toBeNull();
  });

  it('excludes excludeUserId', () => {
    expect(pickNextHost({ participants, present: { A: true, B: true, C: true }, excludeUserId: 'A' })).toBe('B');
  });
});

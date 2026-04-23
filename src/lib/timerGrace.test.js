import { describe, it, expect } from 'vitest';
import { isWithinDeadline, msElapsed } from '@/lib/timerGrace';

describe('msElapsed', () => {
  it('returns arrival - sent in ms', () => {
    expect(msElapsed(new Date('2026-04-24T00:00:03Z'), new Date('2026-04-24T00:00:00Z'))).toBe(3000);
  });

  it('clamps negatives to 0', () => {
    expect(msElapsed(new Date('2026-04-24T00:00:00Z'), new Date('2026-04-24T00:00:03Z'))).toBe(0);
  });

  it('accepts ms numbers, Date objects, ISO strings', () => {
    expect(msElapsed('2026-04-24T00:00:03Z', '2026-04-24T00:00:00Z')).toBe(3000);
    expect(msElapsed(1000, 0)).toBe(1000);
  });
});

describe('isWithinDeadline', () => {
  const GRACE = 500;

  it('true when arrival is before deadline', () => {
    const sent = new Date('2026-04-24T00:00:00Z');
    const arrival = new Date('2026-04-24T00:00:10Z');
    expect(isWithinDeadline({ sentAt: sent, timerS: 15, arrival, graceMs: GRACE })).toBe(true);
  });

  it('true when arrival is within grace after deadline', () => {
    const sent = new Date('2026-04-24T00:00:00Z');
    const arrival = new Date('2026-04-24T00:00:15.300Z');
    expect(isWithinDeadline({ sentAt: sent, timerS: 15, arrival, graceMs: GRACE })).toBe(true);
  });

  it('false when arrival is past deadline + grace', () => {
    const sent = new Date('2026-04-24T00:00:00Z');
    const arrival = new Date('2026-04-24T00:00:16Z');
    expect(isWithinDeadline({ sentAt: sent, timerS: 15, arrival, graceMs: GRACE })).toBe(false);
  });
});

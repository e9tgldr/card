import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('cardVideoLeader', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('takes leadership when no other card is playing', async () => {
    const { takeLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    const pause = vi.fn();
    takeLeadership(1, pause);
    expect(getCurrentId()).toBe(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('pauses the previous leader when a new card takes over', async () => {
    const { takeLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    const pause1 = vi.fn();
    const pause2 = vi.fn();
    takeLeadership(1, pause1);
    takeLeadership(2, pause2);
    expect(getCurrentId()).toBe(2);
    expect(pause1).toHaveBeenCalledTimes(1);
    expect(pause2).not.toHaveBeenCalled();
  });

  it('does not pause the same card re-asserting leadership', async () => {
    const { takeLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    const pause = vi.fn();
    takeLeadership(1, pause);
    takeLeadership(1, pause);
    expect(getCurrentId()).toBe(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('releaseLeadership clears the leader if id matches', async () => {
    const { takeLeadership, releaseLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    takeLeadership(1, vi.fn());
    releaseLeadership(1);
    expect(getCurrentId()).toBeNull();
  });

  it('releaseLeadership is a no-op when id does not match', async () => {
    const { takeLeadership, releaseLeadership, getCurrentId } = await import('@/lib/cardVideoLeader');
    takeLeadership(1, vi.fn());
    releaseLeadership(2);
    expect(getCurrentId()).toBe(1);
  });
});

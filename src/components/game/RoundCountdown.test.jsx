import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import RoundCountdown from '@/components/game/RoundCountdown';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('RoundCountdown', () => {
  it('shows 3 → 2 → 1 → GO over 3 seconds and fires onComplete', () => {
    vi.setSystemTime(new Date(0));
    const onComplete = vi.fn();
    render(<RoundCountdown startTs={new Date(0)} onComplete={onComplete} />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('3');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('countdown')).toHaveTextContent('2');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('countdown')).toHaveTextContent('1');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('countdown')).toHaveTextContent('GO');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

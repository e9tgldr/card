import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Leaderboard from '@/pages/Leaderboard';

vi.mock('@/lib/gameApi', () => ({
  fetchLeaderboard: vi.fn(),
  fetchMyLeaderboardRank: vi.fn(),
}));
vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual('@/lib/i18n');
  return { ...actual, useLang: () => ({ t: (k) => k, lang: 'en' }) };
});
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import { fetchLeaderboard, fetchMyLeaderboardRank } from '@/lib/gameApi';

function R() {
  return render(
    <MemoryRouter>
      <Leaderboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Leaderboard', () => {
  it('fetches and shows weekly by default', async () => {
    fetchLeaderboard.mockResolvedValue([
      { user_id: 'u1', username: 'alpha', total_points: 42, games_played: 6, accuracy_pct: 84.2 },
      { user_id: 'u2', username: 'bravo', total_points: 30, games_played: 5, accuracy_pct: 75.0 },
    ]);
    R();
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(fetchLeaderboard).toHaveBeenCalledWith('weekly', 20);
  });

  it('switches to all-time when the tab is clicked', async () => {
    fetchLeaderboard.mockResolvedValue([]);
    R();
    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalled());

    fetchLeaderboard.mockClear();
    fetchLeaderboard.mockResolvedValue([]);

    fireEvent.click(screen.getByRole('button', { name: /leaderboard.tab.all/i }));
    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledWith('all_time', 20));
  });

  it('shows empty state', async () => {
    fetchLeaderboard.mockResolvedValue([]);
    R();
    await waitFor(() => {
      expect(screen.getByText(/empty\.leaderboard\.title/i)).toBeInTheDocument();
    });
  });

  it('renders skeleton rows while loading', async () => {
    let resolve;
    fetchLeaderboard.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { container } = R();
    expect(container.querySelectorAll('[data-skeleton-cell]').length).toBeGreaterThan(0);
    resolve([]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-skeleton-cell]')).toHaveLength(0);
    });
  });

  it('calls fetchMyLeaderboardRank when user is outside top 20', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      user_id: `other${i}`, username: `user${i}`, total_points: 1000 - i, games_played: 5, accuracy_pct: 70,
    }));
    rows.push({ user_id: 'u1', username: 'me', total_points: 100, games_played: 2, accuracy_pct: 50 });
    fetchLeaderboard.mockResolvedValue(rows);
    fetchMyLeaderboardRank.mockResolvedValue({ rank: 47, total: 200 });

    R();
    await waitFor(() => {
      expect(fetchMyLeaderboardRank).toHaveBeenCalledWith('weekly', 100);
    });
    // The rank cell renders the resolved rank number
    await waitFor(() => {
      expect(screen.getByText('47')).toBeInTheDocument();
    });
  });

  it('does not call fetchMyLeaderboardRank when user is in top 20', async () => {
    const rows = [
      { user_id: 'u1', username: 'me', total_points: 1000, games_played: 5, accuracy_pct: 90 },
    ];
    fetchLeaderboard.mockResolvedValue(rows);
    fetchMyLeaderboardRank.mockResolvedValue(null);

    R();
    await waitFor(() => expect(screen.getByText('me')).toBeInTheDocument());
    // Give effects a moment to settle
    await new Promise((res) => setTimeout(res, 50));
    expect(fetchMyLeaderboardRank).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LiveRoom from '@/pages/LiveRoom';

vi.mock('@/hooks/useLiveRoom', () => ({ useLiveRoom: vi.fn() }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual('@/lib/i18n');
  return { ...actual, useLang: () => ({ t: (k) => k, lang: 'en' }) };
});
vi.mock('@/lib/liveRoomApi', () => ({
  snapshot: vi.fn(),
  joinRoom: vi.fn().mockResolvedValue({ ok: true }),
  startRoom: vi.fn(),
  submitAnswer: vi.fn(),
  requestRematch: vi.fn(),
}));

import { useLiveRoom } from '@/hooks/useLiveRoom';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/games/quotes/live/:code" element={<LiveRoom />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('LiveRoom dispatcher', () => {
  it('shows lobby when status=open', async () => {
    useLiveRoom.mockReturnValue({
      loading: false,
      session: { id: 's1', status: 'open', host_user_id: 'u1', join_code: 'ABCDEF', player_cap: 8 },
      participants: [{ user_id: 'u1', username: 'me' }],
      lastReveal: null, error: null, presence: { u1: true },
    });
    renderAt('/games/quotes/live/ABCDEF');
    await waitFor(() => expect(screen.getByText(/ABCDEF/)).toBeInTheDocument());
  });

  it('shows game view when status=in_progress', async () => {
    useLiveRoom.mockReturnValue({
      loading: false,
      session: {
        id: 's1', status: 'in_progress', host_user_id: 'u1',
        current_round_idx: 0, current_sent_at: new Date().toISOString(),
        timer_s: 15, round_size: 5, seed: 'SEED', lang: 'en',
      },
      participants: [{ user_id: 'u1', username: 'me', current_score: 0 }],
      lastReveal: null, error: null, presence: { u1: true },
    });
    renderAt('/games/quotes/live/ABCDEF');
    await waitFor(() => expect(screen.getByTestId('timer-bar')).toBeInTheDocument());
  });

  it('shows abandoned state when session status is abandoned', async () => {
    useLiveRoom.mockReturnValue({
      loading: false,
      session: { id: 's1', status: 'abandoned' },
      participants: [],
      lastReveal: null, error: null, presence: {},
    });
    renderAt('/games/quotes/live/ABCDEF');
    await waitFor(() => expect(screen.getByText(/live.abandoned/i)).toBeInTheDocument());
  });
});

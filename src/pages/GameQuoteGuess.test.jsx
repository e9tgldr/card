import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameQuoteGuess from './GameQuoteGuess';
import { LangProvider } from '@/lib/i18n';

vi.mock('@/lib/gameApi', () => ({
  createSession: vi.fn(),
  fetchSession: vi.fn(),
  submitResult: vi.fn(),
  fetchLeaderboard: vi.fn(),
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

const renderPage = () => render(
  <LangProvider>
    <MemoryRouter initialEntries={['/games/quotes']}>
      <GameQuoteGuess />
    </MemoryRouter>
  </LangProvider>,
);

beforeEach(() => { vi.clearAllMocks(); });

describe('GameQuoteGuess', () => {
  it('renders a non-blocking skeleton while round builds', async () => {
    const { createSession } = await import('@/lib/gameApi');
    let resolve;
    createSession.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { container } = renderPage();
    expect(container.querySelector('[data-skeleton-cell]')).toBeInTheDocument();
    resolve({ id: 's1', seed: 'seed', join_code: null, share_path: null });
    await waitFor(() => {
      expect(container.querySelector('[data-skeleton-cell]')).not.toBeInTheDocument();
    });
  });

  it('mounts without crashing', async () => {
    const { createSession } = await import('@/lib/gameApi');
    createSession.mockResolvedValue({ id: 's1', seed: 'seed', join_code: null, share_path: null });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText(/loadFailed/)).not.toBeInTheDocument();
    });
  });
});

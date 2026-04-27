import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ScanChat from '@/pages/ScanChat';

const mockInvoke = vi.fn();
const mockUseOwnedFigures = vi.fn();
const mockUseFigureChat = vi.fn();
// currentSession() in this project returns { account_id, username, started_at }
const mockSession = { account_id: 'u1', username: 'a' };
const EXPECTED_USER_ID = 'u1';

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a) => mockInvoke(...a) } },
}));
vi.mock('@/hooks/useOwnedFigures', () => ({ useOwnedFigures: (...a) => mockUseOwnedFigures(...a) }));
vi.mock('@/hooks/useFigureChat', () => ({ useFigureChat: (...a) => mockUseFigureChat(...a) }));
vi.mock('@/lib/authStore', () => ({ currentSession: () => mockSession }));

beforeEach(() => {
  mockInvoke.mockReset();
  mockUseOwnedFigures.mockReset();
  mockUseFigureChat.mockReset();
  mockUseFigureChat.mockReturnValue({
    messages: [], lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
  });
  Element.prototype.scrollIntoView = vi.fn();
});

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/c/:figId" element={<ScanChat />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScanChat — claim flow', () => {
  it('calls claim-card once on mount when figure is not owned', async () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [], loading: false, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, owned: true, newly_claimed: true }, error: null });
    renderAt('/c/1');
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1));
    expect(mockInvoke).toHaveBeenCalledWith('claim-card', { body: { fig_id: 1 } });
  });

  it('does not call claim-card when figure already owned', async () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [1], loading: false, error: null });
    renderAt('/c/1');
    await waitFor(() =>
      expect(mockUseFigureChat).toHaveBeenCalledWith(
        expect.objectContaining({ fig_id: 1 }),
        expect.objectContaining({ userId: EXPECTED_USER_ID, owned: true }),
      ),
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('passes owned=true to useFigureChat after a fresh claim succeeds', async () => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [], loading: false, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, owned: true, newly_claimed: true }, error: null });
    renderAt('/c/1');
    await waitFor(() => {
      const lastCallOpts = mockUseFigureChat.mock.calls[mockUseFigureChat.mock.calls.length - 1][1];
      expect(lastCallOpts).toEqual({ userId: EXPECTED_USER_ID, owned: true });
    });
  });
});

describe('ScanChat — existing UI', () => {
  beforeEach(() => {
    mockUseOwnedFigures.mockReturnValue({ figIds: [], loading: false, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, owned: true, newly_claimed: true }, error: null });
  });

  it('renders AI-thinking indicator when busy', () => {
    mockUseFigureChat.mockReturnValue({
      messages: [], lang: 'mn', busy: true, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt('/c/1');
    expect(screen.getByText(/бодож/i)).toBeInTheDocument();
  });

  it('language toggle buttons have aria-labels', () => {
    mockUseFigureChat.mockReturnValue({
      messages: [], lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt('/c/1');
    const langButtons = screen.getAllByRole('button').filter((b) => /Монгол|English|中文/.test(b.textContent));
    expect(langButtons.length).toBe(3);
    langButtons.forEach((b) => {
      expect(b).toHaveAttribute('aria-label');
      expect(b.getAttribute('aria-label').length).toBeGreaterThan(0);
    });
  });

  it('scrollIntoView called on new message', async () => {
    mockUseFigureChat.mockReturnValue({
      messages: [{ role: 'user', text: 'hi' }],
      lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt('/c/1');
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it('sign-up banner shows new copy explaining why', () => {
    mockUseFigureChat.mockReturnValue({
      messages: [], lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt('/c/1');
    expect(screen.getByText(/түүх|төхөөрөмж/)).toBeInTheDocument();
  });
});

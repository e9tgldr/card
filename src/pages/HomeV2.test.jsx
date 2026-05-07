import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { teamHook, base44Mock, authStoreMock } = vi.hoisted(() => ({
  teamHook: { team: [], removeFromTeam: vi.fn(), isInTeam: () => false, toggleTeam: vi.fn() },
  base44Mock: {
    entities: {
      Figure: { list: vi.fn().mockResolvedValue([]) },
      AppSettings: {
        list: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockReturnValue(() => {}),
        filter: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    },
  },
  authStoreMock: { isGuest: vi.fn(() => false), currentSession: vi.fn(() => null) },
}));

vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual('@/lib/i18n');
  return { ...actual, useLang: () => ({ t: (k) => k, lang: 'mn', setLang: vi.fn() }) };
});
vi.mock('@/hooks/useMyTeam', () => ({ useMyTeam: () => teamHook }));
vi.mock('@/api/base44Client', () => ({ base44: base44Mock }));
vi.mock('@/components/ChatFAB', () => ({ default: () => null }));
vi.mock('@/components/ScrollProgress', () => ({ default: () => null }));
vi.mock('@/components/HistoricalMap', () => ({ default: () => <div data-testid="historical-map" /> }));
vi.mock('@/components/TimelineSection', () => ({ default: () => <div data-testid="timeline-section" /> }));
vi.mock('@/components/CompareBar', () => ({ default: () => null }));
vi.mock('@/lib/authStore', () => authStoreMock);

import HomeV2 from './HomeV2';

afterEach(() => cleanup());

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><HomeV2 /></MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('HomeV2 — render smoke', () => {
  it('renders the brand wordmark and Mongolian H1 accent', () => {
    renderPage();
    expect(screen.getAllByText(/Altan Domog/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Алтан Домогийн/)).toBeInTheDocument();
    expect(screen.getByText(/^нүүр$/)).toBeInTheDocument();
  });

  it('exposes the scan-card primary CTA pointing to /ar', () => {
    renderPage();
    const scanCtas = screen.getAllByRole('link', { name: /Хөзөр уншуулах/ });
    expect(scanCtas.length).toBeGreaterThan(0);
    expect(scanCtas[0]).toHaveAttribute('href', '/ar');
  });

  it('renders the empty My Team state when no team members are saved', () => {
    renderPage();
    expect(screen.getByText(/Чи багаа шилэн ав/)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 5/)).toBeInTheDocument();
  });

  it('renders all 6 chapter cards I–VI', () => {
    renderPage();
    ['I', 'II', 'III', 'IV', 'V', 'VI'].forEach((numeral) => {
      expect(screen.getAllByText(numeral).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/^Хаад$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Орчин үе$/)).toBeInTheDocument();
  });

  it('renders the featured-figure photo strip with non-empty alt', () => {
    renderPage();
    const img = document.querySelector('img[data-photo="sepia"]');
    expect(img).not.toBeNull();
    expect(img.getAttribute('alt')).toBeTruthy();
  });

  it('renders the bottom rotates-daily caption', () => {
    renderPage();
    const cap = document.querySelector('[data-hero="rotates-caption"]');
    expect(cap).not.toBeNull();
    expect(cap.textContent).toMatch(/rotates daily/i);
  });

  it('shows the Guests header link for parent (non-guest) sessions', () => {
    authStoreMock.isGuest.mockReturnValue(false);
    renderPage();
    const guestLink = screen.getByRole('link', { name: /Зочин|Guests/ });
    expect(guestLink).toHaveAttribute('href', '/profile/guests');
  });

  it('hides the Guests header link when the current session is a guest', () => {
    authStoreMock.isGuest.mockReturnValue(true);
    renderPage();
    expect(
      screen.queryByRole('link', { name: /Зочин|Guests/ }),
    ).not.toBeInTheDocument();
  });
});

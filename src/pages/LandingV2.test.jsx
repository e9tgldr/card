import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual('@/lib/i18n');
  return { ...actual, useLang: () => ({ t: (k) => k, lang: 'mn', setLang: vi.fn() }) };
});

import LandingV2 from './LandingV2';

const renderLanding = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><LandingV2 /></MemoryRouter>
    </QueryClientProvider>
  );
};

afterEach(() => cleanup());

describe('LandingV2 — render smoke', () => {
  it('renders the brand wordmark and Mongolian H1', () => {
    renderLanding();
    expect(screen.getAllByText(/Altan Domog/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Их Монгол Улсын/)).toBeInTheDocument();
    expect(screen.getByText(/түүхийн хөзөр/)).toBeInTheDocument();
  });

  it('exposes primary CTAs to the order and app routes', () => {
    renderLanding();
    const orderCta = screen.getAllByRole('link', { name: /Хөзрийн багц захиалах/ })[0];
    expect(orderCta).toHaveAttribute('href', '/order?tier=premium');
    const appCta = screen.getAllByRole('link', { name: /Апп руу орох/ })[0];
    expect(appCta).toHaveAttribute('href', '/app');
  });

  it('renders all 4 how-it-works steps and 3 pricing tiers', () => {
    renderLanding();
    expect(screen.getByText(/QR код уншуулах/)).toBeInTheDocument();
    expect(screen.getByText(/Зүтгэлтэн амилна/)).toBeInTheDocument();
    expect(screen.getByText(/Энгийн хувилбар/)).toBeInTheDocument();
    expect(screen.getByText(/Premium хувилбар/)).toBeInTheDocument();
    expect(screen.getByText(/Collector Edition/)).toBeInTheDocument();
  });

  it('renders the featured-figure portrait with non-empty alt', () => {
    renderLanding();
    const img = document.querySelector('img[data-photo="sepia"]');
    expect(img).not.toBeNull();
    expect(img.getAttribute('alt')).toBeTruthy();
  });

  it('renders the hero meta strip and Pictured caption', () => {
    renderLanding();
    expect(document.querySelector('[data-hero="meta-strip"]')).not.toBeNull();
    expect(document.querySelector('[data-hero="pictured-caption"]')).not.toBeNull();
  });
});

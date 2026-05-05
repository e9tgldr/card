import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual('@/lib/i18n');
  return { ...actual, useLang: () => ({ t: (k) => k, lang: 'mn', setLang: vi.fn() }) };
});

import LandingV2 from './LandingV2';

afterEach(() => cleanup());

describe('LandingV2 — render smoke', () => {
  it('renders the brand wordmark and Mongolian H1', () => {
    render(<MemoryRouter><LandingV2 /></MemoryRouter>);
    expect(screen.getAllByText(/Altan Domog/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Их Монгол Улсын/)).toBeInTheDocument();
    expect(screen.getByText(/түүхийн хөзөр/)).toBeInTheDocument();
  });

  it('exposes primary CTAs to the order and app routes', () => {
    render(<MemoryRouter><LandingV2 /></MemoryRouter>);
    const orderCta = screen.getAllByRole('link', { name: /Хөзрийн багц захиалах/ })[0];
    expect(orderCta).toHaveAttribute('href', '/order?tier=premium');
    const appCta = screen.getAllByRole('link', { name: /Апп руу орох/ })[0];
    expect(appCta).toHaveAttribute('href', '/app');
  });

  it('renders all 4 how-it-works steps and 3 pricing tiers', () => {
    render(<MemoryRouter><LandingV2 /></MemoryRouter>);
    expect(screen.getByText(/QR код уншуулах/)).toBeInTheDocument();
    expect(screen.getByText(/Зүтгэлтэн амилна/)).toBeInTheDocument();
    expect(screen.getByText(/Энгийн хувилбар/)).toBeInTheDocument();
    expect(screen.getByText(/Premium хувилбар/)).toBeInTheDocument();
    expect(screen.getByText(/Collector Edition/)).toBeInTheDocument();
  });

  it('renders the featured-figure portrait with non-empty alt', () => {
    render(<MemoryRouter><LandingV2 /></MemoryRouter>);
    const img = document.querySelector('img[data-photo="sepia"]');
    expect(img).not.toBeNull();
    expect(img.getAttribute('alt')).toBeTruthy();
  });

  it('renders the yellow accent rule and Pictured caption', () => {
    render(<MemoryRouter><LandingV2 /></MemoryRouter>);
    expect(document.querySelector('[data-hero="accent-rule"]')).not.toBeNull();
    expect(document.querySelector('[data-hero="pictured-caption"]')).not.toBeNull();
  });
});

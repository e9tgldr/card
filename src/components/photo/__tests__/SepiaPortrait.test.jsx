import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SepiaPortrait } from '../SepiaPortrait';

afterEach(() => cleanup());

const fig = {
  fig_id: 1,
  name: 'Чингис Хаан',
  years: '1162–1227',
  portrait_url: 'https://example.com/genghis.png',
};

describe('SepiaPortrait', () => {
  it('renders an <img> with src and alt from the figure', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="3/4" />);
    const img = container.querySelector('img[data-photo="sepia"]');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example.com/genghis.png');
    expect(img).toHaveAttribute('alt', 'Чингис Хаан');
  });

  it('applies the sepia CSS filter to the img', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="3/4" />);
    const img = container.querySelector('img[data-photo="sepia"]');
    expect(img.style.filter).toContain('sepia');
  });

  it('renders three aria-hidden overlay layers (tint + grain + vignette)', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="3/4" />);
    const overlays = container.querySelectorAll('[data-photo="sepia-overlay"]');
    expect(overlays.length).toBe(3);
    overlays.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('renders the caption slot when caption prop is provided', () => {
    const { getByText } = render(
      <SepiaPortrait figure={fig} aspectRatio="3/4" caption="Featured · ★" />,
    );
    expect(getByText('Featured · ★')).toBeInTheDocument();
  });

  it('renders a sepia-only fallback when figure has no portrait_url', () => {
    const noPortrait = { ...fig, portrait_url: null };
    const { container } = render(<SepiaPortrait figure={noPortrait} aspectRatio="3/4" />);
    expect(container.querySelector('img[data-photo="sepia"]')).toBeNull();
    expect(container.querySelector('[data-photo="sepia-fallback"]')).not.toBeNull();
  });

  it('honors the aspectRatio prop on the wrapper', () => {
    const { container } = render(<SepiaPortrait figure={fig} aspectRatio="16/9" />);
    const wrap = container.querySelector('[data-photo="sepia-wrap"]');
    expect(wrap.style.aspectRatio).toBe('16/9');
  });
});

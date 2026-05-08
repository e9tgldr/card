import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BrandBook from './BrandBook';

describe('BrandBook integration', () => {
  it('renders the book root', () => {
    render(<BrandBook />);
    expect(screen.getByTestId('brand-book')).toBeTruthy();
  });

  it('mounts all 11 chapter anchors', () => {
    const { container } = render(<BrandBook />);
    const expected = [
      'cover',
      'mission',
      'the-52',
      'product-experience',
      'by-the-numbers',
      'anatomy',
      'editorial-principles',
      'partnership-use-cases',
      'partnership-ask',
      'credibility',
      'press-kit',
    ];
    for (const id of expected) {
      const el = container.querySelector(`#${id}`);
      expect(el, `expected #${id} to be in the document`).toBeTruthy();
    }
  });

  it('shows [FILL] markers in every stub chapter', () => {
    const { container } = render(<BrandBook />);
    const stubs = ['by-the-numbers', 'editorial-principles', 'partnership-use-cases', 'credibility'];
    for (const id of stubs) {
      const section = container.querySelector(`#${id}`);
      expect(section, id).toBeTruthy();
      expect(within(section).getAllByText(/\[FILL\]/).length).toBeGreaterThan(0);
    }
  });

  it('does not show [FILL] in any built chapter', () => {
    const { container } = render(<BrandBook />);
    const built = ['cover', 'mission', 'the-52', 'product-experience', 'anatomy', 'partnership-ask', 'press-kit'];
    for (const id of built) {
      const section = container.querySelector(`#${id}`);
      expect(section, id).toBeTruthy();
      expect(within(section).queryAllByText(/\[FILL\]/).length).toBe(0);
    }
  });

  it('marks Mongolian and English content with lang attributes', () => {
    const { container } = render(<BrandBook />);
    expect(container.querySelectorAll('[lang="mn"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[lang="en"]').length).toBeGreaterThan(0);
  });
});

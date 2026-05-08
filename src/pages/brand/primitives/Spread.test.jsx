import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spread from './Spread';

describe('Spread', () => {
  it('renders children inside a section with a chapter id', () => {
    render(<Spread id="mission"><p>hello</p></Spread>);
    const section = screen.getByText('hello').closest('section');
    expect(section.id).toBe('mission');
  });

  it('renders children inside the spread', () => {
    render(<Spread id="x"><p>body</p></Spread>);
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('uses bg-ink and text-ivory tokens', () => {
    render(<Spread id="x"><p>body</p></Spread>);
    const section = screen.getByText('body').closest('section');
    expect(section.className).toContain('bg-ink');
    expect(section.className).toContain('text-ivory');
  });
});

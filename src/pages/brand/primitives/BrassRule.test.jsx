import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BrassRule from './BrassRule';

describe('BrassRule', () => {
  it('renders an svg line element', () => {
    const { container } = render(<BrassRule from={[0, 0]} to={[100, 100]} />);
    const line = container.querySelector('line');
    expect(line).toBeTruthy();
    expect(line.getAttribute('x1')).toBe('0');
    expect(line.getAttribute('y1')).toBe('0');
    expect(line.getAttribute('x2')).toBe('100');
    expect(line.getAttribute('y2')).toBe('100');
  });

  it('uses brass stroke colour by default', () => {
    const { container } = render(<BrassRule from={[0, 0]} to={[10, 10]} />);
    const line = container.querySelector('line');
    expect(line.getAttribute('stroke')).toBe('hsl(var(--brass))');
  });

  it('renders aria-hidden so it is invisible to screen readers', () => {
    const { container } = render(<BrassRule from={[0, 0]} to={[10, 10]} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});

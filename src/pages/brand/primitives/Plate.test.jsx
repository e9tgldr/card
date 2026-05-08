import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Plate from './Plate';

describe('Plate', () => {
  it('renders the chapter number and Mongolian title', () => {
    render(<Plate number="I" titleMn="Эрхэм зорилго" titleEn="Mission" />);
    expect(screen.getByText('I')).toBeTruthy();
    expect(screen.getByText('Эрхэм зорилго')).toBeTruthy();
  });

  it('marks the title element with lang="mn"', () => {
    render(<Plate number="I" titleMn="Х" titleEn="Mission" />);
    const mn = screen.getByText('Х');
    expect(mn.getAttribute('lang')).toBe('mn');
  });

  it('renders an alt text for the placeholder dark plate', () => {
    render(<Plate number="I" titleMn="Х" titleEn="Mission" />);
    const region = screen.getByRole('img', { name: /Mission/ });
    expect(region).toBeTruthy();
  });
});

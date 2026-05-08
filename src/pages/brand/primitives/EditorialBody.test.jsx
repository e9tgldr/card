import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorialBody from './EditorialBody';

describe('EditorialBody', () => {
  it('renders mn and en copy with correct lang attributes', () => {
    render(<EditorialBody mn="Эрхэм зорилго" en="Our mission" />);
    const mn = screen.getByText('Эрхэм зорилго');
    const en = screen.getByText('Our mission');
    expect(mn.getAttribute('lang')).toBe('mn');
    expect(en.getAttribute('lang')).toBe('en');
  });

  it('renders multi-paragraph mn copy split on blank lines', () => {
    render(<EditorialBody mn={"Para one.\n\nPara two."} en="Eng" />);
    expect(screen.getByText('Para one.')).toBeTruthy();
    expect(screen.getByText('Para two.')).toBeTruthy();
  });

  it('uses italic styling on the english column', () => {
    render(<EditorialBody mn="X" en="Y" />);
    const en = screen.getByText('Y');
    expect(en.className).toContain('italic');
  });
});

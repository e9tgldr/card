import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Specimen from './Specimen';

describe('Specimen', () => {
  it('renders the hero children', () => {
    render(<Specimen callouts={[]}><img alt="hero" /></Specimen>);
    expect(screen.getByAltText('hero')).toBeTruthy();
  });

  it('renders each callout as numbered row with mn and en', () => {
    const callouts = [
      ['1', 'Дүрс', 'Portrait'],
      ['2', 'Нэр', 'Name'],
    ];
    render(<Specimen callouts={callouts}><div /></Specimen>);
    expect(screen.getByText('Дүрс')).toBeTruthy();
    expect(screen.getByText('Portrait')).toBeTruthy();
    expect(screen.getByText('Нэр')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('renders nothing in callout list when callouts is empty', () => {
    const { container } = render(<Specimen callouts={[]}><div /></Specimen>);
    expect(container.querySelectorAll('[data-callout]').length).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Standings from '@/components/game/Standings';

describe('Standings', () => {
  const base = [
    { user_id: 'A', username: 'alpha', correct: 3, total_ms: 5000 },
    { user_id: 'B', username: 'bravo', correct: 2, total_ms: 4000 },
    { user_id: 'C', username: 'charlie', correct: 2, total_ms: 6000 },
  ];

  it('renders ordered rows', () => {
    render(<Standings standings={base} mode="in_round" />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('alpha');
    expect(rows[1]).toHaveTextContent('bravo');
    expect(rows[2]).toHaveTextContent('charlie');
  });

  it('shows scores', () => {
    render(<Standings standings={base} mode="lobby" />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows[0]).toHaveTextContent('3');
    expect(rows[1]).toHaveTextContent('2');
  });

  it('highlights current user row', () => {
    render(<Standings standings={base} mode="in_round" currentUserId="B" />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows[1]).toHaveAttribute('data-me', 'true');
    expect(rows[0]).toHaveAttribute('data-me', 'false');
  });
});

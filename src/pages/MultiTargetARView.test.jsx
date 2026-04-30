import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '@/lib/i18n';

const mockPack = vi.fn();
const mockVideos = vi.fn();
vi.mock('@/hooks/useFigureARPack', () => ({
  useFigureARPack: (...a) => mockPack(...a),
}));
vi.mock('@/hooks/useFigureBackVideos', () => ({
  useFigureBackVideos: (...a) => mockVideos(...a),
}));
vi.mock('@/components/ar/MultiTargetARScene', () => ({
  default: (props) => (
    <div
      data-testid="multi-scene-stub"
      data-pack={props.packUrl}
      data-targets={(props.targetOrder ?? []).join(',')}
    />
  ),
}));

import MultiTargetARView from '@/pages/MultiTargetARView';

function ui() {
  return (
    <LangProvider>
      <MemoryRouter>
        <MultiTargetARView />
      </MemoryRouter>
    </LangProvider>
  );
}

beforeEach(() => {
  mockPack.mockReset();
  mockVideos.mockReset();
});

describe('MultiTargetARView', () => {
  it('shows loading while pack loads', () => {
    mockPack.mockReturnValue({ loading: true, ready: false, packUrl: null, targetOrder: null });
    mockVideos.mockReturnValue({ isLoading: false, data: {} });
    render(ui());
    expect(screen.getByTestId('ar-view-loading')).toBeInTheDocument();
  });

  it('shows pack-missing panel when no pack uploaded', () => {
    mockPack.mockReturnValue({ loading: false, ready: false, packUrl: null, targetOrder: null });
    mockVideos.mockReturnValue({ isLoading: false, data: {} });
    render(ui());
    expect(screen.getByRole('heading', { name: /AR багц|AR pack not ready/i })).toBeInTheDocument();
  });

  it('mounts MultiTargetARScene with packUrl + targetOrder when ready', () => {
    mockPack.mockReturnValue({
      loading: false,
      ready: true,
      packUrl: 'pack/ar.mind',
      targetOrder: [1, 2, 3],
    });
    mockVideos.mockReturnValue({ isLoading: false, data: { 1: { url: 'v1' } } });
    render(ui());
    const stub = screen.getByTestId('multi-scene-stub');
    expect(stub).toHaveAttribute('data-pack', 'pack/ar.mind');
    expect(stub).toHaveAttribute('data-targets', '1,2,3');
  });
});

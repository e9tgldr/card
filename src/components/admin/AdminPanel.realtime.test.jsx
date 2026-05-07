import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const { notifyMocks } = vi.hoisted(() => ({
  notifyMocks: {
    error: vi.fn(), success: vi.fn(), info: vi.fn(),
    loading: vi.fn(), promise: vi.fn((p) => p), dismiss: vi.fn(), dismissAll: vi.fn(),
  },
}));
vi.mock('@/lib/feedback', () => ({
  notify: notifyMocks,
  useDebouncedValue: (v) => v,
  EmptyState: ({ title, description }) => (<div data-testid='empty-state'>{title}{description ? ' — ' + description : ''}</div>),
}));

// Capture the subscribe callback so the test can drive realtime events.
const { subscribeCb, base44Mock } = vi.hoisted(() => {
  const ref = { current: null };
  return {
    subscribeCb: ref,
    base44Mock: {
      base44: {
        auth: { me: vi.fn().mockResolvedValue({ id: 'a1', is_admin: true }) },
        entities: {
          Figure: {
            list: vi.fn().mockResolvedValue([]),
            update: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            subscribe: vi.fn((cb) => { ref.current = cb; return () => { ref.current = null; }; }),
          },
        },
        integrations: { Core: { UploadFile: vi.fn() } },
      },
    },
  };
});
vi.mock('@/api/base44Client', () => base44Mock);

vi.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({ settings: { site_name: '', site_logo: '' }, saveSetting: vi.fn() }),
}));
vi.mock('@/hooks/useFigureBackVideos', () => ({
  useFigureBackVideos: () => ({ data: {}, refetch: vi.fn() }),
}));
vi.mock('@/components/admin/Tournaments', () => ({ default: () => null }));
vi.mock('@/components/admin/Voices', () => ({ default: () => null }));
vi.mock('@/components/admin/Eras', () => ({ default: () => null }));
vi.mock('@/components/admin/StoryEditorModal', () => ({ default: () => null }));
vi.mock('@/components/admin/ARPackUploader', () => ({ default: () => null }));
vi.mock('@/components/admin/BackVideos', () => ({ default: () => null }));
vi.mock('@/lib/authStore', () => ({
  listInviteCodes: vi.fn().mockResolvedValue([]),
  createInviteCode: vi.fn(),
  deleteInviteCode: vi.fn(),
  listAccounts: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/ordersStore', () => ({
  listOrders: vi.fn().mockResolvedValue([]),
  updateOrderStatus: vi.fn(),
  deleteOrder: vi.fn(),
}));

import AdminPanel from './AdminPanel';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  subscribeCb.current = null;
  Object.values(notifyMocks).forEach((m) => m.mockClear?.());
});

const STARTING = [
  { fig_id: 1, name: 'Чингис', cat: 'khans', ico: '👑' },
  { fig_id: 2, name: 'Өгөдэй', cat: 'khans', ico: '👑' },
  { fig_id: 3, name: 'Кубилай', cat: 'khans', ico: '👑' },
];

describe('AdminPanel — realtime payload merge', () => {
  it('UPDATE event patches the matching row by fig_id without refetching the list', async () => {
    let figures = STARTING.map((f) => ({ ...f }));
    const onFiguresChange = vi.fn((updater) => {
      figures = typeof updater === 'function' ? updater(figures) : updater;
    });
    render(<AdminPanel figures={figures} onClose={() => {}} onFiguresChange={onFiguresChange} />);

    expect(subscribeCb.current).toBeTypeOf('function');
    act(() => {
      subscribeCb.current({
        type: 'update',
        id: 'uuid-1',
        data: { id: 'uuid-1', fig_id: 1, name: 'Чингис Хаан', front_img: 'https://x/a.jpg' },
      });
    });

    expect(onFiguresChange).toHaveBeenCalledTimes(1);
    expect(figures[0]).toMatchObject({ fig_id: 1, name: 'Чингис Хаан', front_img: 'https://x/a.jpg' });
    expect(figures[1].name).toBe('Өгөдэй');
    expect(figures[2].name).toBe('Кубилай');
    expect(base44Mock.base44.entities.Figure.list).not.toHaveBeenCalled();
  });

  it('INSERT event appends a new row sorted by fig_id', async () => {
    let figures = STARTING.map((f) => ({ ...f }));
    const onFiguresChange = vi.fn((updater) => {
      figures = typeof updater === 'function' ? updater(figures) : updater;
    });
    render(<AdminPanel figures={figures} onClose={() => {}} onFiguresChange={onFiguresChange} />);

    act(() => {
      subscribeCb.current({
        type: 'create',
        id: 'uuid-15',
        data: { id: 'uuid-15', fig_id: 15, name: 'Бөртэ', cat: 'queens' },
      });
    });

    expect(figures.map((f) => f.fig_id)).toEqual([1, 2, 3, 15]);
    expect(figures[3].name).toBe('Бөртэ');
  });

  it('DELETE event removes a row matched by fig_id', async () => {
    let figures = STARTING.map((f) => ({ ...f, id: `uuid-${f.fig_id}` }));
    const onFiguresChange = vi.fn((updater) => {
      figures = typeof updater === 'function' ? updater(figures) : updater;
    });
    render(<AdminPanel figures={figures} onClose={() => {}} onFiguresChange={onFiguresChange} />);

    act(() => {
      subscribeCb.current({
        type: 'delete',
        id: 'uuid-2',
        data: { id: 'uuid-2', fig_id: 2 },
      });
    });

    expect(figures.map((f) => f.fig_id)).toEqual([1, 3]);
  });
});

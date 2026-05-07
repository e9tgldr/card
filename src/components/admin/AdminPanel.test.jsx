import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me: vi.fn().mockResolvedValue({ id: 'a1', is_admin: true }) },
    entities: {
      Figure: {
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        subscribe: vi.fn(() => () => {}),
      },
    },
    integrations: {
      Core: { UploadFile: vi.fn() },
    },
  },
}));

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
  listInviteCodes: vi.fn().mockResolvedValue({ codes: [], has_more: false, limit: 2000 }),
  listAllInviteCodes: vi.fn().mockResolvedValue([]),
  createInviteCode: vi.fn(),
  deleteInviteCode: vi.fn(),
  listAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/ordersStore', () => ({
  listOrders: vi.fn().mockResolvedValue({ orders: [], has_more: false, limit: 200 }),
  updateOrderStatus: vi.fn(),
  deleteOrder: vi.fn(),
}));

import AdminPanel from './AdminPanel';

afterEach(() => { cleanup(); document.body.style.overflow = ''; Object.values(notifyMocks).forEach((m) => m.mockClear?.()); });

describe('AdminPanel polish', () => {
  it('mounts without crashing', () => {
    render(<AdminPanel figures={[]} onClose={() => {}} onFiguresChange={() => {}} />);
    expect(screen.getByText(/Админ Панел/)).toBeInTheDocument();
  });
});

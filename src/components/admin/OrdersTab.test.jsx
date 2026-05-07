import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
        update: vi.fn(), create: vi.fn(), delete: vi.fn(),
        subscribe: vi.fn(() => () => {}),
      },
    },
    integrations: { Core: { UploadFile: vi.fn() } },
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
  listInviteCodes: vi.fn().mockResolvedValue([]),
  createInviteCode: vi.fn(),
  deleteInviteCode: vi.fn(),
  listAccounts: vi.fn().mockResolvedValue([]),
}));

const { ordersMock } = vi.hoisted(() => ({
  ordersMock: {
    listOrders: vi.fn(),
    updateOrderStatus: vi.fn(),
    deleteOrder: vi.fn(),
  },
}));
vi.mock('@/lib/ordersStore', () => ordersMock);

import AdminPanel from './AdminPanel';

const SAMPLE_ORDERS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    tier: 'premium',
    customer_name: 'Бат-Эрдэнэ',
    customer_phone: '99112233',
    customer_address: 'УБ, Сүхбаатар, 1-р хороо',
    notes: 'Орой 6 цагаас хойш',
    status: 'pending',
    created_at: '2026-05-06T10:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    tier: 'collector',
    customer_name: 'Сараа',
    customer_phone: '88001122',
    customer_address: 'Дархан',
    notes: null,
    status: 'confirmed',
    created_at: '2026-05-05T08:00:00Z',
  },
];

beforeEach(() => {
  ordersMock.listOrders.mockResolvedValue([...SAMPLE_ORDERS]);
  ordersMock.updateOrderStatus.mockResolvedValue({ id: SAMPLE_ORDERS[0].id, status: 'confirmed' });
  ordersMock.deleteOrder.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  Object.values(notifyMocks).forEach((m) => m.mockClear?.());
  Object.values(ordersMock).forEach((m) => m.mockClear?.());
});

describe('AdminPanel — Orders tab', () => {
  it('calls listOrders exactly once at AdminPanel mount; opening the tab does not refetch', async () => {
    const user = userEvent.setup();
    render(<AdminPanel figures={[]} onClose={() => {}} onFiguresChange={() => {}} />);

    // Single canonical fetch at mount — shared by dashboard count + OrdersTab.
    await waitFor(() => expect(ordersMock.listOrders).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('tab', { name: /Захиалга/ }));

    // forceMount + lifted state mean tab open does NOT refetch.
    expect(await screen.findByText('Бат-Эрдэнэ')).toBeInTheDocument();
    expect(ordersMock.listOrders).toHaveBeenCalledTimes(1);
    // Default filter is "pending" — only the pending order should show.
    expect(screen.queryByText('Сараа')).not.toBeInTheDocument();
  });

  it('shows confirmed rows when filter is changed', async () => {
    const user = userEvent.setup();
    render(<AdminPanel figures={[]} onClose={() => {}} onFiguresChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /Захиалга/ }));
    await screen.findByText('Бат-Эрдэнэ');

    await user.click(screen.getByRole('button', { name: /Бүгд/ }));
    expect(await screen.findByText('Сараа')).toBeInTheDocument();
    expect(screen.getByText('Бат-Эрдэнэ')).toBeInTheDocument();
  });

  it('approves a pending order via the Зөвшөөрөх button', async () => {
    const user = userEvent.setup();
    render(<AdminPanel figures={[]} onClose={() => {}} onFiguresChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /Захиалга/ }));
    await screen.findByText('Бат-Эрдэнэ');

    await user.click(screen.getByRole('button', { name: /Зөвшөөрөх/ }));

    await waitFor(() =>
      expect(ordersMock.updateOrderStatus).toHaveBeenCalledWith(
        SAMPLE_ORDERS[0].id,
        'confirmed',
      ),
    );
  });

  it('rolls back optimistic state when updateOrderStatus rejects', async () => {
    ordersMock.updateOrderStatus.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    render(<AdminPanel figures={[]} onClose={() => {}} onFiguresChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /Захиалга/ }));
    await screen.findByText('Бат-Эрдэнэ');

    await user.click(screen.getByRole('button', { name: /Зөвшөөрөх/ }));

    // After rollback the row is still in the pending tab — still rendered.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Зөвшөөрөх/ })).toBeInTheDocument(),
    );
  });

  it('does not clobber a concurrent successful row when another row rolls back', async () => {
    // Three rows so we can verify cross-row isolation:
    //   pending(A) — admin clicks Approve, succeeds
    //   pending(B) — admin clicks Approve, FAILS → must rollback B only
    //   confirmed(C) — must remain confirmed throughout
    const A = { ...SAMPLE_ORDERS[0], id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', customer_name: 'Ариунаа' };
    const B = { ...SAMPLE_ORDERS[0], id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', customer_name: 'Болд' };
    const C = { ...SAMPLE_ORDERS[1], id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', customer_name: 'Цэцэгээ', status: 'confirmed' };
    ordersMock.listOrders.mockResolvedValue([A, B, C]);

    // First Approve (row A) succeeds, second Approve (row B) fails.
    ordersMock.updateOrderStatus
      .mockResolvedValueOnce({ id: A.id, status: 'confirmed' })
      .mockRejectedValueOnce(new Error('boom'));

    const user = userEvent.setup();
    render(<AdminPanel figures={[]} onClose={() => {}} onFiguresChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /Захиалга/ }));
    await screen.findByText('Ариунаа');

    // Approve row A (Ариунаа is alphabetically first → first Approve button).
    const approveBtns = screen.getAllByRole('button', { name: /Зөвшөөрөх/ });
    expect(approveBtns).toHaveLength(2); // A and B are pending; C is confirmed (no Approve button)
    await user.click(approveBtns[0]);
    await waitFor(() => expect(ordersMock.updateOrderStatus).toHaveBeenCalledTimes(1));

    // After A succeeds and the pending filter hides it, only B's Approve remains.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Зөвшөөрөх/ })).toHaveLength(1),
    );

    // Approve row B → rejects → only B should rollback.
    await user.click(screen.getByRole('button', { name: /Зөвшөөрөх/ }));
    await waitFor(() => expect(ordersMock.updateOrderStatus).toHaveBeenCalledTimes(2));

    // Switch to "Бүгд" filter and verify A is still confirmed (not rolled back).
    await user.click(screen.getByRole('button', { name: /^Бүгд/ }));
    // C must still be visible as confirmed
    expect(await screen.findByText('Цэцэгээ')).toBeInTheDocument();
    // A must remain visible (it succeeded — confirmed status, would only show in Бүгд / Зөвшөөрсөн)
    expect(screen.getByText('Ариунаа')).toBeInTheDocument();
    // B must be visible again with pending status (the row rolled back)
    expect(screen.getByText('Болд')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { LangProvider } from '@/lib/i18n';

const mockInvoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a) => mockInvoke(...a) } },
}));

const mockPack = vi.fn();
vi.mock('@/hooks/useFigureARPack', () => ({
  useFigureARPack: (...a) => mockPack(...a),
}));

// useConfirm fires a real dialog modal — for tests we just auto-confirm.
vi.mock('@/components/ui/use-confirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    dialog: null,
  }),
}));

import ARPackUploader from '@/components/admin/ARPackUploader';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <LangProvider>{ui}</LangProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockInvoke.mockReset();
  mockPack.mockReset();
});

describe('ARPackUploader', () => {
  it('shows "no pack" status and only the Upload button when no pack exists', () => {
    mockPack.mockReturnValue({ ready: false, targetOrder: null });
    render(wrap(<ARPackUploader />));
    expect(screen.getByText(/Багц хуулагдаагүй|No pack uploaded/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ar-pack-delete-button')).toBeNull();
  });

  it('shows target count, Replace + Delete, and a populated order list when a pack exists', () => {
    mockPack.mockReturnValue({ ready: true, targetOrder: [1, 14, 24] });
    render(wrap(<ARPackUploader />));
    expect(screen.getByText(/3 targets/)).toBeInTheDocument();
    expect(screen.getByTestId('ar-pack-delete-button')).toBeInTheDocument();
    const list = screen.getByTestId('ar-pack-order-list');
    expect(within(list).getAllByTestId(/^ar-pack-order-row-/)).toHaveLength(3);
  });

  it('rejects non-.mind file client-side', async () => {
    mockPack.mockReturnValue({ ready: false, targetOrder: null });
    render(wrap(<ARPackUploader />));
    const input = screen.getByTestId('ar-pack-file-input');
    const bad = new File(['x'], 'pack.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(mockInvoke).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/.mind|extension/i);
    });
  });

  it('invokes upload-figure-ar-pack with action + file + serialised order on .mind upload', async () => {
    mockPack.mockReturnValue({ ready: false, targetOrder: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, target_count: 52 }, error: null });
    render(wrap(<ARPackUploader />));
    const input = screen.getByTestId('ar-pack-file-input');
    const file = new File([new Uint8Array([1, 2, 3])], 'all-cards.mind', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'upload-figure-ar-pack',
      expect.objectContaining({ body: expect.any(FormData) }),
    ));
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.get('action')).toBe('upload-pack');
    const orderJson = JSON.parse(String(body.get('target_order')));
    expect(Array.isArray(orderJson)).toBe(true);
    expect(orderJson.length).toBeGreaterThan(0);
  });

  it('removes a target via the row × button and marks the editor dirty', () => {
    mockPack.mockReturnValue({ ready: true, targetOrder: [1, 14, 24] });
    render(wrap(<ARPackUploader />));
    expect(screen.queryByTestId('ar-pack-order-dirty')).toBeNull();
    fireEvent.click(screen.getByTestId('ar-pack-order-remove-1'));
    const list = screen.getByTestId('ar-pack-order-list');
    expect(within(list).getAllByTestId(/^ar-pack-order-row-/)).toHaveLength(2);
    expect(screen.getByTestId('ar-pack-order-dirty')).toBeInTheDocument();
  });

  it('adds a target from the picker and saves the new order via update-target-order', async () => {
    mockPack.mockReturnValue({ ready: true, targetOrder: [1, 14] });
    mockInvoke.mockResolvedValue({ data: { ok: true, target_count: 3 }, error: null });
    render(wrap(<ARPackUploader />));

    fireEvent.click(screen.getByTestId('ar-pack-order-add-toggle'));
    fireEvent.click(screen.getByTestId('ar-pack-order-adder-pick-24'));

    const list = screen.getByTestId('ar-pack-order-list');
    expect(within(list).getAllByTestId(/^ar-pack-order-row-/)).toHaveLength(3);
    expect(screen.getByTestId('ar-pack-order-dirty')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ar-pack-order-save'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'upload-figure-ar-pack',
      { body: { action: 'update-target-order', target_order: [1, 14, 24] } },
    ));
  });

  it('disables Save when there are no unsaved changes', () => {
    mockPack.mockReturnValue({ ready: true, targetOrder: [1, 2, 3] });
    render(wrap(<ARPackUploader />));
    expect(screen.getByTestId('ar-pack-order-save')).toBeDisabled();
  });

  it('disables Save when no pack has been uploaded yet', () => {
    mockPack.mockReturnValue({ ready: false, targetOrder: null });
    render(wrap(<ARPackUploader />));
    // Make a local edit so dirty=true; save should still be blocked because there is no pack.
    fireEvent.click(screen.getByTestId('ar-pack-order-add-toggle'));
    expect(screen.getByTestId('ar-pack-order-save')).toBeDisabled();
  });

  it('replaces a row in place when picking a figure not currently in the order', () => {
    mockPack.mockReturnValue({ ready: true, targetOrder: [1, 14, 24] });
    render(wrap(<ARPackUploader />));
    fireEvent.click(screen.getByTestId('ar-pack-order-edit-1'));
    expect(screen.getByTestId('ar-pack-order-editor-1')).toBeInTheDocument();
    // Pick figure id 36 which is not currently in the order — straight replace.
    fireEvent.click(screen.getByTestId('ar-pack-order-editor-pick-1-36'));
    expect(screen.getByTestId('ar-pack-order-figid-1')).toHaveTextContent('id 36');
    expect(screen.getByTestId('ar-pack-order-dirty')).toBeInTheDocument();
  });

  it('swaps two rows when picking a figure that is already in the order', () => {
    mockPack.mockReturnValue({ ready: true, targetOrder: [1, 14, 24] });
    render(wrap(<ARPackUploader />));
    fireEvent.click(screen.getByTestId('ar-pack-order-edit-0'));
    // Pick figure id 24 — already at row 2, so picking it from row 0 should swap.
    fireEvent.click(screen.getByTestId('ar-pack-order-editor-pick-0-24'));
    expect(screen.getByTestId('ar-pack-order-figid-0')).toHaveTextContent('id 24');
    expect(screen.getByTestId('ar-pack-order-figid-2')).toHaveTextContent('id 1');
  });
});

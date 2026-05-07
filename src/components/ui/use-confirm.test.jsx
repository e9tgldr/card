import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfirm } from './use-confirm';

function Harness({ recordResult }) {
  const { confirm, dialog } = useConfirm();
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({ title: 'sure?', confirmLabel: 'Yes', cancelLabel: 'No' });
          recordResult(ok);
        }}
      >
        ask
      </button>
      <button
        type="button"
        onClick={async () => {
          // Two rapid asks — should not orphan the first promise.
          const a = confirm({ title: 'first', confirmLabel: 'Y1', cancelLabel: 'N1' });
          const b = confirm({ title: 'second', confirmLabel: 'Y2', cancelLabel: 'N2' });
          const [ra, rb] = await Promise.all([a, b]);
          recordResult({ ra, rb });
        }}
      >
        ask twice
      </button>
      {dialog}
    </div>
  );
}

afterEach(cleanup);

describe('useConfirm', () => {
  it('resolves true when the confirm action is clicked', async () => {
    const results = [];
    const user = userEvent.setup();
    render(<Harness recordResult={(r) => results.push(r)} />);

    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(await screen.findByRole('button', { name: 'Yes' }));

    await waitFor(() => expect(results).toEqual([true]));
  });

  it('resolves false when the cancel button is clicked', async () => {
    const results = [];
    const user = userEvent.setup();
    render(<Harness recordResult={(r) => results.push(r)} />);

    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(await screen.findByRole('button', { name: 'No' }));

    await waitFor(() => expect(results).toEqual([false]));
  });

  it('resolves false when the dialog is dismissed via Escape (does not double-resolve)', async () => {
    const results = [];
    const user = userEvent.setup();
    render(<Harness recordResult={(r) => results.push(r)} />);

    await user.click(screen.getByRole('button', { name: 'ask' }));
    await screen.findByRole('button', { name: 'Yes' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(results).toEqual([false]));
    // No second resolve: still exactly one entry after the natural close path.
    expect(results).toHaveLength(1);
  });

  it('resolves the prior pending confirm as cancelled when a new confirm() is requested', async () => {
    const results = [];
    const user = userEvent.setup();
    render(<Harness recordResult={(r) => results.push(r)} />);

    await user.click(screen.getByRole('button', { name: 'ask twice' }));
    // First Promise resolves to false (cancelled by second call), second
    // Promise still awaits user input — confirm it.
    await user.click(await screen.findByRole('button', { name: 'Y2' }));

    await waitFor(() => expect(results).toEqual([{ ra: false, rb: true }]));
  });

  it('resolves a pending confirm as cancelled when the host component unmounts', async () => {
    const results = [];
    const user = userEvent.setup();
    const { unmount } = render(<Harness recordResult={(r) => results.push(r)} />);

    await user.click(screen.getByRole('button', { name: 'ask' }));
    await screen.findByRole('button', { name: 'Yes' });

    unmount();

    await waitFor(() => expect(results).toEqual([false]));
  });
});

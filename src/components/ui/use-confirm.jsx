import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const DEFAULTS = {
  title: 'Та итгэлтэй байна уу?',
  body: '',
  confirmLabel: 'Тийм',
  cancelLabel: 'Болих',
  danger: false,
};

// Imperative confirm dialog for admin flows. Replaces window.confirm() so the
// buttons render in Mongolian and the visual style matches the rest of the
// admin panel. Use:
//
//   const { confirm, dialog } = useConfirm();
//   ...
//   if (!(await confirm({ title: '…', body: '…', danger: true }))) return;
//   // ...proceed with destructive action
//
//   return <>...{dialog}</>;
//
// The dialog is a portal, so its position in the JSX tree doesn't matter.
//
// Resolution model: Radix's AlertDialog can fire onOpenChange(false) AND the
// explicit Cancel/Action onClick handlers, so we centralise resolution in a
// single ref-guarded helper to make resolution exactly-once. A second
// confirm() call while one is still pending resolves the prior call as
// cancelled rather than orphaning its Promise.
export function useConfirm() {
  const [state, setState] = useState({ open: false, opts: DEFAULTS });
  const resolveRef = useRef(null);
  const settledRef = useRef(true);

  const settle = useCallback((result) => {
    if (settledRef.current) return;
    settledRef.current = true;
    const r = resolveRef.current;
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
    r?.(result);
  }, []);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      // If a previous confirm is still pending, resolve it as cancelled.
      if (!settledRef.current) {
        settledRef.current = true;
        const prev = resolveRef.current;
        resolveRef.current = null;
        prev?.(false);
      }
      resolveRef.current = resolve;
      settledRef.current = false;
      setState({ open: true, opts: { ...DEFAULTS, ...opts } });
    });
  }, []);

  // If the host component unmounts while a confirm is pending, resolve the
  // promise as cancelled so awaiting code paths don't hang forever. We bypass
  // `settle` here to avoid scheduling a setState on an unmounted component.
  useEffect(() => {
    return () => {
      if (!settledRef.current) {
        settledRef.current = true;
        const r = resolveRef.current;
        resolveRef.current = null;
        r?.(false);
      }
    };
  }, []);

  const dialog = (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => { if (!open) settle(false); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.opts.title}</AlertDialogTitle>
          {state.opts.body && <AlertDialogDescription>{state.opts.body}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>{state.opts.cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={state.opts.danger ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
          >
            {state.opts.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}

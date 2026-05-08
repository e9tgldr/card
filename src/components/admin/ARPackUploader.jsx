import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, RefreshCw, Trash2, Layers, GripVertical, X, Plus, RotateCcw, Save, Search } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useFigureARPack } from '@/hooks/useFigureARPack';
import { FIGURES } from '@/lib/figuresData';
import { useConfirm } from '@/components/ui/use-confirm';
import { adminErrorText } from '@/lib/adminErrors';

const MAX_PACK_BYTES = 30 * 1024 * 1024;

const DEFAULT_ORDER = FIGURES.map((f) => f.fig_id);
const FIGURES_BY_ID = Object.fromEntries(FIGURES.map((f) => [f.fig_id, f]));

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export default function ARPackUploader() {
  const { t } = useLang();
  const pack = useFigureARPack();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [order, setOrder] = useState(DEFAULT_ORDER);
  const [adderOpen, setAdderOpen] = useState(false);
  const [adderFilter, setAdderFilter] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const inputRef = useRef(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Sync editor state from server whenever the persisted order changes (e.g.
  // first load, or after another admin saves). Editing here only mutates
  // local state; nothing leaves the client until Save / .mind upload.
  useEffect(() => {
    if (Array.isArray(pack.targetOrder) && pack.targetOrder.length > 0) {
      setOrder(pack.targetOrder);
    }
  }, [pack.targetOrder]);

  const persisted = useMemo(
    () => (Array.isArray(pack.targetOrder) && pack.targetOrder.length > 0 ? pack.targetOrder : DEFAULT_ORDER),
    [pack.targetOrder],
  );
  const dirty = !arraysEqual(order, persisted);

  const usedSet = useMemo(() => new Set(order), [order]);
  const available = useMemo(
    () => FIGURES.filter((f) => !usedSet.has(f.fig_id)),
    [usedSet],
  );
  const filteredAvailable = useMemo(() => {
    const q = adderFilter.trim().toLowerCase();
    if (!q) return available;
    return available.filter((f) =>
      `${f.fig_id} ${f.name} ${f.role || ''}`.toLowerCase().includes(q),
    );
  }, [available, adderFilter]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      return next;
    });
  };

  const handleRemove = (idx) => {
    setOrder((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAdd = (figId) => {
    if (usedSet.has(figId)) {
      setError(t('admin.arPack.targetOrder.duplicate'));
      return;
    }
    setOrder((prev) => [...prev, figId]);
    setAdderFilter('');
  };

  const handleResetToDefault = async () => {
    const ok = await confirm({
      title: t('admin.arPack.targetOrder.reset'),
      confirmLabel: 'Тийм',
    });
    if (!ok) return;
    setOrder(DEFAULT_ORDER);
  };

  const handleSaveOrder = async () => {
    if (!order.length) {
      setError(t('admin.arPack.targetOrder.empty'));
      return;
    }
    setError('');
    setSavingOrder(true);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-ar-pack', {
      body: { action: 'update-target-order', target_order: order },
    });
    setSavingOrder(false);
    if (invErr || !data?.ok) {
      setError(adminErrorText(data?.reason || invErr?.message || 'server'));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['figure_ar_pack'] });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleUpload = async (file) => {
    setError('');
    if (!file.name.toLowerCase().endsWith('.mind')) {
      setError(t('admin.arPack.notMind'));
      return;
    }
    if (file.size > MAX_PACK_BYTES) {
      setError(t('admin.arPack.tooBig', { mb: (file.size / 1024 / 1024).toFixed(1) }));
      return;
    }
    if (!order.length) {
      setError(t('admin.arPack.targetOrder.empty'));
      return;
    }

    if (pack.ready) {
      const ok = await confirm({
        title: t('admin.arPack.replaceWarn'),
        confirmLabel: 'Тийм',
        danger: true,
      });
      if (!ok) return;
    }

    setBusy(true);
    const form = new FormData();
    form.append('action', 'upload-pack');
    form.append('file', file);
    form.append('target_order', JSON.stringify(order));
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-ar-pack', {
      body: form,
    });
    setBusy(false);
    if (invErr || !data?.ok) {
      setError(adminErrorText(data?.reason || invErr?.message || 'server'));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['figure_ar_pack'] });
  };

  const handleDelete = async () => {
    if (!pack.ready) return;
    const ok = await confirm({
      title: t('admin.arPack.replaceWarn'),
      confirmLabel: 'Тийм',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-ar-pack', {
      body: { action: 'delete-pack' },
    });
    setBusy(false);
    if (invErr || !data?.ok) {
      setError(adminErrorText(data?.reason || invErr?.message || 'server'));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['figure_ar_pack'] });
  };

  const saveDisabled = savingOrder || !dirty || !pack.ready || order.length === 0;

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs text-ivory/70 font-body">{t('admin.arPack.help')}</p>
      <p className="text-[11px] text-muted-foreground font-body">
        .mind файл, дээд тал нь {(MAX_PACK_BYTES / 1024 / 1024).toFixed(0)} MB.
      </p>
      {error && (
        <div role="alert" className="px-3 py-2 rounded bg-red-950/50 border border-red-500 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
        <Layers className="w-5 h-5 text-brass" />
        <div className="flex-1 min-w-0">
          <div className="font-cinzel text-sm font-bold truncate">
            {pack.ready ? `✓ ${pack.targetOrder.length} targets` : t('admin.arPack.empty')}
          </div>
        </div>
        <input
          type="file"
          accept=".mind"
          className="hidden"
          ref={inputRef}
          data-testid="ar-pack-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          data-testid="ar-pack-upload-button"
          onClick={() => inputRef.current?.click()}
          className="gap-1"
        >
          {pack.ready ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
          {pack.ready ? t('admin.arPack.replace') : t('admin.arPack.upload')}
        </Button>
        {pack.ready && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid="ar-pack-delete-button"
            onClick={handleDelete}
            className="gap-1 text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('admin.arPack.delete')}
          </Button>
        )}
      </div>

      <section aria-label={t('admin.arPack.targetOrder')} className="space-y-2">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs text-brass/80 font-meta tracking-[0.2em] uppercase">
              {t('admin.arPack.targetOrder')}
            </h3>
            <p className="text-[11px] text-muted-foreground font-body mt-1">
              {t('admin.arPack.targetOrder.hint')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <span
                data-testid="ar-pack-order-dirty"
                className="text-[10px] text-amber-300 font-meta tracking-[0.18em] uppercase"
              >
                {t('admin.arPack.targetOrder.dirty')}
              </span>
            )}
            {savedFlash && (
              <span
                data-testid="ar-pack-order-saved"
                className="text-[10px] text-emerald-300 font-meta tracking-[0.18em] uppercase"
              >
                {t('admin.arPack.targetOrder.saved')}
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResetToDefault}
              data-testid="ar-pack-order-reset"
              className="gap-1 text-[11px]"
              type="button"
            >
              <RotateCcw className="w-3 h-3" />
              {t('admin.arPack.targetOrder.reset')}
            </Button>
            <Button
              size="sm"
              variant={dirty ? 'default' : 'outline'}
              onClick={handleSaveOrder}
              disabled={saveDisabled}
              data-testid="ar-pack-order-save"
              className="gap-1"
              type="button"
            >
              <Save className="w-3.5 h-3.5" />
              {t('admin.arPack.targetOrder.save')}
            </Button>
          </div>
        </header>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="ar-pack-order-list">
            {(droppableProvided) => (
              <ol
                {...droppableProvided.droppableProps}
                ref={droppableProvided.innerRef}
                data-testid="ar-pack-order-list"
                className="border border-brass/30 rounded divide-y divide-brass/15 bg-ink/40"
              >
                {order.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-ivory/55 font-body">
                    {t('admin.arPack.targetOrder.empty')}
                  </li>
                )}
                {order.map((figId, idx) => {
                  const fig = FIGURES_BY_ID[figId];
                  return (
                    <Draggable key={figId} draggableId={`fig-${figId}`} index={idx}>
                      {(draggableProvided, snapshot) => (
                        <li
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          data-testid={`ar-pack-order-row-${idx}`}
                          className={`flex items-center gap-3 px-3 py-2 ${
                            snapshot.isDragging ? 'bg-brass/10' : ''
                          }`}
                        >
                          <span
                            {...draggableProvided.dragHandleProps}
                            aria-label="Drag to reorder"
                            className="cursor-grab active:cursor-grabbing text-brass/55 hover:text-brass"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className="font-mono text-[11px] text-brass/70 w-8 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-[11px] text-ivory/55 w-10">
                            id {figId}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-sm text-ivory">
                            {fig ? fig.name : `${t('admin.arPack.targetOrder.unknown')} #${figId}`}
                          </span>
                          {fig && (
                            <span className="font-mono text-[11px] text-ivory/45 truncate">
                              {fig.yrs}
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label={t('admin.arPack.targetOrder.remove')}
                            data-testid={`ar-pack-order-remove-${idx}`}
                            onClick={() => handleRemove(idx)}
                            className="p-1 rounded text-ivory/50 hover:text-red-300 hover:bg-red-950/30"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      )}
                    </Draggable>
                  );
                })}
                {droppableProvided.placeholder}
              </ol>
            )}
          </Droppable>
        </DragDropContext>

        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => setAdderOpen((v) => !v)}
            disabled={available.length === 0}
            data-testid="ar-pack-order-add-toggle"
            className="gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('admin.arPack.targetOrder.add')}
          </Button>
          {adderOpen && available.length > 0 && (
            <div
              data-testid="ar-pack-order-adder"
              className="mt-2 border border-brass/30 rounded bg-ink/95 max-h-72 overflow-auto"
            >
              <label className="flex items-center gap-2 px-3 py-2 border-b border-brass/20">
                <Search className="w-3.5 h-3.5 text-ivory/40" />
                <input
                  type="text"
                  value={adderFilter}
                  onChange={(e) => setAdderFilter(e.target.value)}
                  placeholder={t('admin.arPack.targetOrder.searchPlaceholder')}
                  data-testid="ar-pack-order-adder-search"
                  className="flex-1 bg-transparent text-sm text-ivory outline-none placeholder:text-ivory/35"
                  autoFocus
                />
              </label>
              <ul>
                {filteredAvailable.map((f) => (
                  <li key={f.fig_id}>
                    <button
                      type="button"
                      onClick={() => handleAdd(f.fig_id)}
                      data-testid={`ar-pack-order-adder-pick-${f.fig_id}`}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-ivory hover:bg-brass/10"
                    >
                      <span className="font-mono text-[11px] text-ivory/55 w-10">
                        id {f.fig_id}
                      </span>
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="font-mono text-[11px] text-ivory/45">{f.yrs}</span>
                    </button>
                  </li>
                ))}
                {filteredAvailable.length === 0 && (
                  <li className="px-3 py-3 text-center text-sm text-ivory/45 font-body">
                    —
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </section>
      {confirmDialog}
    </div>
  );
}

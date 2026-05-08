import { useState, useEffect, useRef, useCallback } from 'react';
import { X, LayoutDashboard, Pencil, Grid3X3, Settings, Save, Trash2, Plus, Upload, Download, Palette, Ticket, Copy, Check, ShoppingBag, RefreshCw, Loader2, MoreHorizontal } from 'lucide-react';
import { notify, useDebouncedValue, EmptyState } from '@/lib/feedback';

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useConfirm } from '@/components/ui/use-confirm';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { CATEGORIES } from '@/lib/figuresData';
import AdminTournaments from '@/components/admin/Tournaments';
import AdminVoices from '@/components/admin/Voices';
import StoryEditorModal from '@/components/admin/StoryEditorModal';
import AdminEras from '@/components/admin/Eras';
import BackVideos from '@/components/admin/BackVideos';
import ARPackUploader from '@/components/admin/ARPackUploader';
import { useFigureBackVideos } from '@/hooks/useFigureBackVideos';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { listInviteCodes, listAllInviteCodes, createInviteCode, deleteInviteCode, listAccounts } from '@/lib/authStore';
import { listOrders, updateOrderStatus, deleteOrder } from '@/lib/ordersStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { adminErrorText } from '@/lib/adminErrors';

// Whitelist of columns that actually exist on `public.figures`. Anything
// outside this set gets stripped before the upsert; callers (saveFig,
// upload handlers) routinely pass shapes that include UI-only fields like
// `story`/`story_en` (live in `story_content`, not on figures) or seed
// fields like `portrait_url` (legacy FIGURES constant only). Without the
// filter, PostgREST returns PGRST204 ("column not found") and the save
// silently fails behind a generic "save failed" toast.
const FIGURE_COLUMNS = new Set([
  'fig_id', 'cat', 'ico', 'card', 'name', 'yrs', 'role',
  'bio', 'achs', 'fact', 'quote', 'qattr', 'rel',
  'front_img', 'back_img',
]);

// Upsert a single figure row by its natural key fig_id. Solves the case
// where `selectedFig.id` is undefined because the figure originates from
// the in-memory FIGURES constant — a plain `update(id, patch)` would
// silently match zero rows. Returns the persisted row so callers can
// pick up the now-existing `id` for subsequent calls.
async function upsertFigureByFigId(fig, patch) {
  const merged = { fig_id: fig.fig_id, ...patch };
  const seed = {};
  for (const [key, value] of Object.entries(merged)) {
    if (FIGURE_COLUMNS.has(key)) seed[key] = value;
  }
  const { data, error } = await supabase
    .from('figures')
    .upsert(seed, { onConflict: 'fig_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export default function AdminPanel({ figures, onClose, onFiguresChange }) {
  const [tab, setTab] = useState('dashboard');
  const [selectedFig, setSelectedFig] = useState(null);
  const [storyEditing, setStoryEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [figSearch, setFigSearch] = useState('');
  const [logs, setLogs] = useState([]);
  const { settings, saveSetting } = useAppSettings();
  const { data: videosById, refetch: refetchVideos } = useFigureBackVideos();
  const [brandForm, setBrandForm] = useState({ site_name: '', site_logo: '' });
  const [savingFig, setSavingFig] = useState(false);
  // Orders state lives in AdminPanel so the dashboard pending-count card and
  // the OrdersTab share a single fetch + cache. OrdersTab is forceMount-ed
  // below so its local UI state (filter chip, busy ids, scroll position)
  // survives tab switches; the data itself never needs a remount-driven
  // refetch.
  const [orders, setOrders] = useState([]);
  // Tracks whether the orders list was truncated by the per-request cap so
  // pending-count badges can render an honest "+" suffix instead of pretending
  // the first page is the whole dataset.
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const ordersMountedRef = useRef(true);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Sync brandForm when settings load
  useEffect(() => {
    setBrandForm({ site_name: settings.site_name, site_logo: settings.site_logo });
  }, [settings.site_name, settings.site_logo]);

  // Thin wrapper around the shared `notify.*` toaster so admin actions
  // surface in the same top-center toast layer as the rest of the app
  // (no more bottom-center custom AdminToast competing with HotToaster).
  // Signature unchanged so the 6 sub-tab onToast prop pass-throughs keep
  // working as-is.
  const showToast = (msg, isError = false) => {
    if (isError) notify.error(msg);
    else notify.success(msg);
  };

  // Stable across renders so the realtime-subscription effect (and any
  // future effects with `[]` deps) closes over a consistent reference.
  // Capped at 200 entries so a long admin session can't grow the log
  // unboundedly.
  const addLog = useCallback((msg, level = 'ok') => {
    const time = new Date().toLocaleTimeString('mn-MN');
    setLogs(prev => [...prev, { time, msg, level }].slice(-200));
  }, []);

  // Body scroll lock isolated from the realtime subscription so a failure in
  // one path can't strand the page in a locked state. The cleanup also runs
  // when an ErrorBoundary unmounts the panel after a render-phase throw.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ESC closes the panel. Skip when:
  //  - a sub-modal (story editor) is open — its own dismiss handles it
  //  - focus is in an editable element — user wants to clear input / dismiss IME
  //  - a Radix dialog (e.g. confirm dialog) is open — its dismiss runs first
  //  - the keydown was already handled (e.g. by an inner listener)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      if (storyEditing) return;
      const target = e.target;
      if (target instanceof Element) {
        if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (target.closest('[role="alertdialog"], [role="dialog"]')) return;
      }
      if (typeof document !== 'undefined' && document.querySelector('[role="alertdialog"][data-state="open"], [role="dialog"][data-state="open"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, storyEditing]);

  useEffect(() => {
    addLog('Админ панел нээгдлээ', 'ok');

    // Live sync: apply each figure-row event directly instead of refetching
    // the full list. Match by `fig_id` (natural key) first, falling back to
    // `id` (PK) so deletes — where Supabase Realtime may only ship the PK in
    // `old` unless the table is configured with REPLICA IDENTITY FULL — still
    // resolve. This is O(1) per event vs the previous N×N round-trip + merge,
    // and harmlessly idempotent against the admin's own optimistic writes.
    const unsub = base44.entities.Figure.subscribe((event) => {
      try {
        const row = event.data;
        if (!row) return;

        if (event.type === 'delete') {
          onFiguresChange(prev => prev.filter(f =>
            !(row.id != null && f.id === row.id) &&
            !(row.fig_id != null && f.fig_id === row.fig_id),
          ));
        } else {
          onFiguresChange(prev => {
            const idx = prev.findIndex(f =>
              (row.fig_id != null && f.fig_id === row.fig_id) ||
              (row.id != null && f.id === row.id),
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...row };
              return next;
            }
            return [...prev, row].sort((a, b) => (a.fig_id ?? 0) - (b.fig_id ?? 0));
          });
        }
        addLog(`DB өөрчлөлт: ${event.type} #${event.id?.slice?.(0, 6) ?? ''}`, 'ok');
      } catch (err) {
        notify.error(err, { fallbackKey: 'toast.admin.realtimeFailed' });
        addLog(`Subscription error: ${err.message}`, 'err');
      }
    });

    return () => { unsub(); };
  }, []);

  // One canonical orders fetch on AdminPanel mount, shared by the dashboard
  // count card and the (forceMount-ed) OrdersTab. `refreshOrders` is the
  // refresh handle exposed to OrdersTab's "Сэргээх" button.
  const refreshOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { orders: list, has_more } = await listOrders();
      if (ordersMountedRef.current) {
        setOrders(list);
        setOrdersHasMore(has_more);
      }
    } catch (e) {
      // Surface only when the OrdersTab is the active surface — otherwise
      // the dashboard count just stays as "—".
      if (ordersMountedRef.current) {
        addLog(`Захиалгын ачаалт амжилтгүй: ${adminErrorText(e)}`, 'err');
      }
    } finally {
      if (ordersMountedRef.current) setOrdersLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    ordersMountedRef.current = true;
    refreshOrders();
    return () => { ordersMountedRef.current = false; };
  }, [refreshOrders]);

  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;

  const selectFig = (fig) => {
    setSelectedFig(fig);
    setEditForm({
      name: fig.name || '',
      yrs: fig.yrs || '',
      card: fig.card || '',
      cat: fig.cat || 'khans',
      ico: fig.ico || '👑',
      role: fig.role || '',
      bio: fig.bio || '',
      fact: fig.fact || '',
      quote: fig.quote || '',
      qattr: fig.qattr || '',
      story: fig.story || '',
      story_en: fig.story_en || '',
      achs: (fig.achs || []).join('\n'),
      rel: (fig.rel || []).join(', '),
    });
    setTab('editor');
  };

  const saveFig = async () => {
    const updated = {
      ...selectedFig,
      ...editForm,
      achs: editForm.achs.split('\n').filter(Boolean),
      rel: editForm.rel.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
    };

    // Optimistic update — snapshot first so we can roll back on error.
    const snapshot = figures.map(f => ({ ...f }));
    const newFigs = figures.map(f => f.fig_id === updated.fig_id ? updated : f);
    if (!figures.find(f => f.fig_id === updated.fig_id)) {
      newFigs.push(updated);
    }
    onFiguresChange(newFigs);

    setSavingFig(true);
    const promise = (async () => {
      const row = await upsertFigureByFigId(selectedFig, updated);
      updated.id = row.id;
      addLog(`${updated.name} хадгалагдлаа`, 'ok');
    })();

    try {
      await notify.promise(promise, {
        loading: 'toast.admin.saving',
        success: 'toast.admin.saved',
        error: 'toast.admin.saveFailed',
      });
    } catch (err) {
      onFiguresChange(snapshot);
      addLog(`Хадгалахад алдаа: ${err.message}`, 'err');
    } finally {
      setSavingFig(false);
    }
  };

  const deleteFig = async () => {
    if (!selectedFig) return;
    const ok = await confirm({
      title: `"${selectedFig.name}" устгах уу?`,
      body: 'Энэ үйлдлийг буцаах боломжгүй.',
      confirmLabel: 'Устгах',
      danger: true,
    });
    if (!ok) return;
    try {
      if (selectedFig.id) {
        await base44.entities.Figure.delete(selectedFig.id);
      }
      const newFigs = figures.filter(f => f.fig_id !== selectedFig.fig_id);
      onFiguresChange(newFigs);
      setSelectedFig(null);
      showToast('Устгагдлаа');
      addLog(`${selectedFig.name} устгагдлаа`, 'warn');
    } catch (err) {
      showToast('Устгахад алдаа гарлаа', true);
      addLog(`Figure delete failed: ${err?.message ?? err}`, 'err');
    }
  };

  const addFig = () => {
    const maxId = Math.max(0, ...figures.map(f => f.fig_id));
    const newFig = {
      fig_id: maxId + 1,
      cat: 'khans',
      ico: '👑',
      card: 'Шинэ Хөзөр',
      name: 'Шинэ Зүтгэлтэн',
      yrs: '',
      role: '',
      bio: '',
      achs: [],
      fact: '',
      quote: null,
      qattr: null,
      rel: [],
    };
    selectFig(newFig);
    addLog('Шинэ зүтгэлтэн нэмэгдлээ', 'ok');
  };

  const handleImageUpload = async (e, side) => {
    const file = e.target.files[0];
    if (!file || !selectedFig) return;

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const fieldName = side === 'front' ? 'front_img' : 'back_img';
      const row = await upsertFigureByFigId(selectedFig, { [fieldName]: file_url });

      const updated = { ...selectedFig, ...row, [fieldName]: file_url, id: row.id };
      setSelectedFig(updated);
      const newFigs = figures.map(f => f.fig_id === updated.fig_id ? updated : f);
      onFiguresChange(newFigs);
      showToast(`${side === 'front' ? 'Нүүр' : 'Ар'} зураг байршуулагдлаа`);
      addLog(`${selectedFig.name} - ${side} зураг байршуулагдлаа`, 'ok');
    } catch (err) {
      showToast('Зураг байршуулахад алдаа гарлаа', true);
      addLog(`Image upload (${side}) failed: ${err?.message ?? err}`, 'err');
    }
  };

  const handleAudioUpload = async (e, locale) => {
    const file = e.target.files[0];
    if (!file || !selectedFig) return;
    if (file.size > MAX_AUDIO_BYTES) {
      notify.error('toast.admin.audioTooLarge');
      return;
    }
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const fieldName = locale === 'en' ? 'story_audio_en' : 'story_audio';
      const row = await upsertFigureByFigId(selectedFig, { [fieldName]: file_url });

      const updated = { ...selectedFig, ...row, [fieldName]: file_url, id: row.id };
      setSelectedFig(updated);
      const newFigs = figures.map(f => f.fig_id === updated.fig_id ? updated : f);
      onFiguresChange(newFigs);
      showToast(`${locale === 'en' ? 'Англи' : 'Монгол'} аудио байршуулагдлаа`);
      addLog(`${selectedFig.name} - ${locale} story audio uploaded (${(file.size / 1024).toFixed(0)} KB)`, 'ok');
    } catch (err) {
      showToast('Аудио байршуулахад алдаа гарлаа', true);
      addLog(`Audio upload (${locale}) failed: ${err?.message ?? err}`, 'err');
    }
  };

  const handleAudioRemove = async (locale) => {
    if (!selectedFig) return;
    const fieldName = locale === 'en' ? 'story_audio_en' : 'story_audio';
    const row = await upsertFigureByFigId(selectedFig, { [fieldName]: null });
    const updated = { ...selectedFig, ...row, [fieldName]: null, id: row.id };
    setSelectedFig(updated);
    const newFigs = figures.map(f => f.fig_id === updated.fig_id ? updated : f);
    onFiguresChange(newFigs);
    showToast('Аудио устгагдлаа');
  };

  const exportDeck = () => {
    const blob = new Blob([JSON.stringify(figures, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mhpc-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Экспортлогдлоо');
  };

  const debouncedFigSearch = useDebouncedValue(figSearch, 250);
  const filteredFigs = figures.filter(f =>
    !debouncedFigSearch || f.name.toLowerCase().includes(debouncedFigSearch.toLowerCase())
  );

  const catCounts = {};
  figures.forEach(f => { catCounts[f.cat] = (catCounts[f.cat] || 0) + 1; });

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <h2 className="font-cinzel text-lg font-bold text-foreground">Админ Панел</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="mx-6 mt-4 overflow-x-auto">
        <TabsList className="bg-muted/40 border border-border w-max max-w-none">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs font-body">
            <LayoutDashboard className="w-3.5 h-3.5" /> Хянах
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-1.5 text-xs font-body">
            <Pencil className="w-3.5 h-3.5" /> Засварлах
          </TabsTrigger>
          <TabsTrigger value="deck" className="gap-1.5 text-xs font-body">
            <Grid3X3 className="w-3.5 h-3.5" /> Хөзрүүд
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-1.5 text-xs font-body">
            <Ticket className="w-3.5 h-3.5" /> Уригдсан код
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5 text-xs font-body">
            <ShoppingBag className="w-3.5 h-3.5" /> Захиалга
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs font-body">
            <Settings className="w-3.5 h-3.5" /> Тохиргоо
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="gap-1.5 text-xs font-body">
            🏆 Тэмцээн
          </TabsTrigger>
          <TabsTrigger value="voices" className="gap-1.5 text-xs font-body">
            🎙 Дуу хоолой
          </TabsTrigger>
          <TabsTrigger value="eras" className="gap-1.5 text-xs font-body">
            📖 Бүлэг
          </TabsTrigger>
          <TabsTrigger value="back-videos" className="gap-1.5 text-xs font-body">
            🎬 Видео
          </TabsTrigger>
          <TabsTrigger value="ar-pack" className="gap-1.5 text-xs font-body">
            📦 AR Pack
          </TabsTrigger>
        </TabsList>
        </div>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Нийт Зүтгэлтэн', value: figures.length, ico: '🎴' },
              { label: 'Ангилал', value: Object.keys(CATEGORIES).length, ico: '📂' },
              { label: 'Зурагтай', value: figures.filter(f => f.front_img).length, ico: '🖼️' },
              {
                label: 'Хүлээгдэж буй захиалга',
                value: ordersLoading && orders.length === 0
                  ? '—'
                  : `${pendingOrdersCount}${ordersHasMore ? '+' : ''}`,
                ico: '🟡',
                onClick: () => setTab('orders'),
              },
            ].map((s, i) => {
              const cardClass = `bg-card border border-border rounded-xl p-4 space-y-1 ${
                s.onClick ? 'cursor-pointer hover:border-gold transition-colors text-left w-full' : ''
              }`;
              const content = (
                <>
                  <span className="text-2xl">{s.ico}</span>
                  <div className="font-cinzel text-xl font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground font-body">{s.label}</div>
                </>
              );
              return s.onClick
                ? <button key={i} type="button" onClick={s.onClick} className={cardClass}>{content}</button>
                : <div key={i} className={cardClass}>{content}</div>;
            })}
          </div>
          
          {/* Category breakdown */}
          <div className="bg-card border border-border rounded-xl p-4 mb-8">
            <h3 className="font-cinzel text-sm font-bold mb-4">Ангилалын Хуваарилалт</h3>
            <div className="space-y-3">
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-6 text-center">{cat.ico}</span>
                  <span className="text-xs font-body text-muted-foreground w-24">{cat.label}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${((catCounts[key] || 0) / figures.length) * 100}%`, background: cat.color }}
                    />
                  </div>
                  <span className="text-xs font-body text-muted-foreground w-8 text-right">{catCounts[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Log */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-cinzel text-sm font-bold mb-3">Лог</h3>
            <ScrollArea className="h-48">
              <div className="space-y-1 font-mono text-xs">
                {logs.map((l, i) => (
                  <div key={i} className={`${l.level === 'err' ? 'text-red-400' : l.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>
                    [{l.time}] {l.msg}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* Editor */}
        <TabsContent value="editor" className="flex-1 overflow-hidden p-6">
          <div className="flex gap-6 h-full">
            {/* Figure list */}
            <div className="w-64 flex-shrink-0 flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  value={figSearch}
                  onChange={e => setFigSearch(e.target.value)}
                  placeholder="Хайх..."
                  className="bg-muted border-none text-xs font-body"
                />
                <Button size="icon" variant="outline" onClick={addFig}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1">
                  {filteredFigs.map(f => (
                    <button
                      key={f.fig_id}
                      onClick={() => selectFig(f)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-body transition-colors ${
                        selectedFig?.fig_id === f.fig_id ? 'bg-crimson/20 text-foreground' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {f.ico} {f.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Edit form */}
            <ScrollArea className="flex-1">
              {selectedFig ? (
                <div className="space-y-4 pr-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-cinzel font-bold text-foreground">{selectedFig.name}</h3>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={deleteFig} className="gap-1 text-xs font-body">
                        <Trash2 className="w-3.5 h-3.5" /> Устгах
                      </Button>
                      <Button size="sm" onClick={saveFig} disabled={savingFig} className="gap-1 text-xs font-body bg-crimson hover:bg-crimson/90 text-white">
                        {savingFig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {savingFig ? 'Хадгалж байна…' : 'Хадгалах'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Нэр</label>
                      <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="bg-muted border-none text-sm font-body" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Он</label>
                      <Input value={editForm.yrs} onChange={e => setEditForm({...editForm, yrs: e.target.value})} className="bg-muted border-none text-sm font-body" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Хөзрийн нэр</label>
                      <Input value={editForm.card} onChange={e => setEditForm({...editForm, card: e.target.value})} className="bg-muted border-none text-sm font-body" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Ангилал</label>
                      <Select value={editForm.cat} onValueChange={v => setEditForm({...editForm, cat: v})}>
                        <SelectTrigger className="bg-muted border-none text-sm font-body"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORIES).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.ico} {v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Эможи</label>
                      <Input value={editForm.ico} onChange={e => setEditForm({...editForm, ico: e.target.value})} className="bg-muted border-none text-sm font-body" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Албан тушаал</label>
                      <Input value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="bg-muted border-none text-sm font-body" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-body">Намтар</label>
                    <Textarea value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} className="bg-muted border-none text-sm font-body min-h-[100px]" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-body">Түүх</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStoryEditing(selectedFig)}
                      className="w-full"
                    >
                      📝 Түүх засах (mn + en)
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-body">Гавьяа (мөр бүрт нэг)</label>
                    <Textarea value={editForm.achs} onChange={e => setEditForm({...editForm, achs: e.target.value})} className="bg-muted border-none text-sm font-body min-h-[100px]" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-body">Сонирхолтой баримт</label>
                    <Textarea value={editForm.fact} onChange={e => setEditForm({...editForm, fact: e.target.value})} className="bg-muted border-none text-sm font-body min-h-[100px]" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Хэлсэн үг</label>
                      <Input value={editForm.quote || ''} onChange={e => setEditForm({...editForm, quote: e.target.value})} className="bg-muted border-none text-sm font-body" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Эх сурвалж</label>
                      <Input value={editForm.qattr || ''} onChange={e => setEditForm({...editForm, qattr: e.target.value})} className="bg-muted border-none text-sm font-body" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-body">Холбоотой зүтгэлтнүүд</label>
                    <RelChipInput
                      value={editForm.rel}
                      onChange={(rel) => setEditForm({ ...editForm, rel })}
                      figures={figures}
                    />
                  </div>

                  {/* Storytelling */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎙️</span>
                      <h4 className="text-sm font-cinzel font-semibold text-foreground">Түүхэн Яриа</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-body">
                      <strong>Дуу хоолой</strong>: Урьдчилан бичсэн MP3 файл байвал тэр нь тоглогдоно. Хоосон үлдвэл доорх <strong>текстийг</strong> хөтчийн TTS уншина.
                    </p>

                    {/* Pre-recorded audio upload — MN + EN */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'mn', label: 'Аудио (Монгол)', field: 'story_audio' },
                        { key: 'en', label: 'Audio (English)', field: 'story_audio_en' },
                      ].map(slot => {
                        const url = selectedFig[slot.field];
                        return (
                          <div key={slot.key} className="space-y-2">
                            <label className="text-xs text-muted-foreground font-body">{slot.label}</label>
                            {url ? (
                              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                                <audio
                                  src={url}
                                  controls
                                  preload="metadata"
                                  className="w-full h-9"
                                />
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                                    🎵 {url.startsWith('data:') ? 'data URL' : url.split('/').pop()}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 text-xs flex-shrink-0"
                                    onClick={() => handleAudioRemove(slot.key)}
                                  >
                                    Устгах
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-border hover:border-gold cursor-pointer transition-colors">
                                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground font-body">MP3 / WAV байршуулах</span>
                                <span className="text-[9px] text-muted-foreground/60 font-body mt-0.5">(дээд тал нь 5 MB)</span>
                                <input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={e => handleAudioUpload(e, slot.key)}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Fallback TTS scripts */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Түүх — текст (Монгол) <span className="text-muted-foreground/60">/ TTS-д</span></label>
                      <Textarea
                        value={editForm.story}
                        onChange={e => setEditForm({ ...editForm, story: e.target.value })}
                        placeholder="Аудио байхгүй үед энэ текстийг хөтөч уншина..."
                        className="bg-muted border-none text-sm font-body min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-body">Story — text (English) <span className="text-muted-foreground/60">/ TTS fallback</span></label>
                      <Textarea
                        value={editForm.story_en}
                        onChange={e => setEditForm({ ...editForm, story_en: e.target.value })}
                        placeholder="Spoken-word narration for EN mode…"
                        className="bg-muted border-none text-sm font-body min-h-[100px]"
                      />
                    </div>
                  </div>

                  {/* Image upload */}
                  <div className="space-y-3">
                    <h4 className="text-xs text-muted-foreground font-body font-semibold">Зурагнууд</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {['front', 'back'].map(side => (
                        <div key={side} className="space-y-2">
                          <label className="text-xs text-muted-foreground font-body">{side === 'front' ? 'Нүүр' : 'Ар'} зураг</label>
                          {selectedFig[`${side}_img`] ? (
                            <div className="relative rounded-lg overflow-hidden border border-border">
                              <img src={selectedFig[`${side}_img`]} alt={side} className="w-full h-32 object-cover" crossOrigin="anonymous" />
                              <Button
                                size="sm"
                                variant="destructive"
                                className="absolute top-2 right-2 h-7 text-xs"
                                onClick={async () => {
                                  try {
                                    const row = await upsertFigureByFigId(selectedFig, { [`${side}_img`]: null });
                                    const updated = { ...selectedFig, ...row, [`${side}_img`]: null, id: row.id };
                                    setSelectedFig(updated);
                                    const newFigs = figures.map(f => f.fig_id === updated.fig_id ? updated : f);
                                    onFiguresChange(newFigs);
                                    showToast('Зураг устгагдлаа');
                                  } catch (err) {
                                    showToast('Устгахад алдаа гарлаа', true);
                                    addLog(`Image remove (${side}) failed: ${err?.message ?? err}`, 'err');
                                  }
                                }}
                              >
                                Устгах
                              </Button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed border-border hover:border-gold cursor-pointer transition-colors">
                              <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground font-body">Зураг оруулах</span>
                              <span className="text-[9px] text-muted-foreground/60 font-body mt-0.5">JPG / PNG / WebP</span>
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, side)} />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <EmptyState
                    icon={<Pencil className="w-8 h-8 text-muted-foreground/60" />}
                    title="Зүтгэлтэн сонгоно уу"
                    description="Зүүн талын жагсаалтаас аль нэгийг сонгож засварлаж эхэл."
                  />
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* Deck */}
        <TabsContent value="deck" className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {figures.map(f => (
              <button
                key={f.fig_id}
                onClick={() => selectFig(f)}
                className="bg-card border border-border rounded-lg p-3 text-center hover:border-gold transition-colors space-y-1"
              >
                <span className="text-2xl block">{f.ico}</span>
                <p className="text-[10px] font-body text-foreground truncate">{f.name}</p>
                <p className="text-[9px] text-muted-foreground font-body truncate">{f.card}</p>
                <Badge variant="outline" className="text-[8px] px-1 py-0" style={{ borderColor: CATEGORIES[f.cat]?.color, color: CATEGORIES[f.cat]?.color }}>
                  {CATEGORIES[f.cat]?.label}
                </Badge>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Invites — forceMount so the codes/accounts list survives tab switches. */}
        <TabsContent value="invites" forceMount className="data-[state=inactive]:hidden flex-1 overflow-auto p-6">
          <InvitesTab onToast={showToast} onLog={addLog} />
        </TabsContent>

        {/* Orders — state lifted into AdminPanel; forceMount preserves UI state
           (filter chip, busyIds, scroll) across tab switches. */}
        <TabsContent value="orders" forceMount className="data-[state=inactive]:hidden flex-1 overflow-auto p-6">
          <OrdersTab
            orders={orders}
            setOrders={setOrders}
            hasMore={ordersHasMore}
            loading={ordersLoading}
            onRefresh={refreshOrders}
            onToast={showToast}
            onLog={addLog}
          />
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-8">

            {/* Branding */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-gold" />
                <h3 className="font-cinzel font-bold text-foreground">Сайтын Нэр & Лого</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-body">Лого (emoji)</label>
                  <Input
                    value={brandForm.site_logo}
                    onChange={e => setBrandForm(f => ({ ...f, site_logo: e.target.value }))}
                    className="bg-muted border-none text-2xl font-body w-20"
                    placeholder="🏇"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-body">Сайтын нэр</label>
                  <Input
                    value={brandForm.site_name}
                    onChange={e => setBrandForm(f => ({ ...f, site_name: e.target.value }))}
                    className="bg-muted border-none text-sm font-body"
                    placeholder="Altan Domog"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl bg-muted px-4 py-2 flex items-center gap-2">
                  <span className="text-xl">{brandForm.site_logo || '🏇'}</span>
                  <span className="font-cinzel text-sm font-bold text-foreground">{brandForm.site_name || 'Altan Domog'}</span>
                </div>
                <Button
                  onClick={async () => {
                    await saveSetting('site_logo', brandForm.site_logo || '🏇');
                    await saveSetting('site_name', brandForm.site_name || 'Altan Domog');
                    showToast('Брэнд хадгаллаа!');
                    addLog('Сайтын нэр/лого шинэчлэгдлээ', 'ok');
                  }}
                  className="bg-gold text-background hover:bg-gold/90 font-body gap-1.5 text-sm shrink-0"
                >
                  <Save className="w-3.5 h-3.5" /> Хадгалах
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground font-body">Өөрчлөлт бүх төхөөрөмж дээр шууд тусна.</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-cinzel font-bold text-foreground">📦 Экспорт</h3>
              <Button onClick={exportDeck} variant="outline" className="gap-2 font-body text-sm">
                <Download className="w-4 h-4" /> JSON татах
              </Button>
            </div>
          </div>
        </TabsContent>
        {/* Tournaments / Voices / Eras — forceMount so each tab's mount-time
           supabase fetch fires once at panel-open instead of every reopen. */}
        <TabsContent value="tournaments" forceMount className="data-[state=inactive]:hidden flex-1 overflow-auto p-6">
          <AdminTournaments onToast={showToast} />
        </TabsContent>

        <TabsContent value="voices" forceMount className="data-[state=inactive]:hidden flex-1 overflow-auto p-6">
          <AdminVoices onToast={showToast} />
        </TabsContent>

        <TabsContent value="eras" forceMount className="data-[state=inactive]:hidden flex-1 overflow-auto p-6">
          <AdminEras onToast={showToast} />
        </TabsContent>

        {/* Back Videos */}
        <TabsContent value="back-videos" className="flex-1 overflow-auto p-6">
          <BackVideos
            figures={figures}
            videosById={videosById ?? {}}
            onChange={() => refetchVideos()}
          />
        </TabsContent>

        {/* AR Pack (multi-target combined .mind) */}
        <TabsContent value="ar-pack" className="flex-1 overflow-auto p-6">
          <ARPackUploader />
        </TabsContent>

      </Tabs>

      {/* Story editor modal */}
      {storyEditing && (
        <StoryEditorModal
          figure={storyEditing}
          onClose={() => setStoryEditing(null)}
          onToast={showToast}
        />
      )}

      {/* Confirm dialog (rendered via portal, position-independent) */}
      {confirmDialog}
    </div>
  );
}

const INVITE_BATCH_MAX = 1500;

function InvitesTab({ onToast, onLog }) {
  const [invites, setInvites] = useState([]);
  // True when the loaded `invites` list was truncated by the per-request cap.
  // Drives a "+" suffix on stat cards / button labels and switches the CSV
  // export to a paginated walk so admins don't get a silently-truncated file.
  const [invitesHasMore, setInvitesHasMore] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [grantsAdmin, setGrantsAdmin] = useState(false);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [deletingCode, setDeletingCode] = useState(null);
  const deletingRef = useRef(new Set());
  const { confirm, dialog: confirmDialog } = useConfirm();

  const refresh = async () => {
    try {
      const [{ codes, has_more }, accs] = await Promise.all([
        listInviteCodes(),
        listAccounts(),
      ]);
      setInvites(codes);
      setInvitesHasMore(has_more);
      setAccounts(accs);
    } catch (e) {
      onToast('Код ачаалахад алдаа: ' + adminErrorText(e), true);
    }
  };

  useEffect(() => { refresh(); }, []);

  const accountById = (id) => accounts.find(a => a.id === id);

  const handleCreate = async (overrideCount) => {
    const raw = overrideCount ?? count;
    const n = Math.max(1, Math.min(INVITE_BATCH_MAX, Math.floor(Number(raw) || 1)));
    setBusy(true);
    try {
      const { codes } = await createInviteCode({ count: n, grants_admin: grantsAdmin });
      await refresh();
      const made = codes?.length ?? 0;
      if (made === 0) {
        onToast('Код үүсгэж чадсангүй', true);
      } else if (made === 1) {
        onToast(`Код үүсгэлээ: ${codes[0]}`);
        onLog(`Уригдсан код үүслээ: ${codes[0]}${grantsAdmin ? ' (админ)' : ''}`, 'ok');
      } else {
        onToast(`${made} код үүсгэлээ`);
        onLog(`${made} уригдсан код үүслээ${grantsAdmin ? ' (админ)' : ''}`, 'ok');
      }
    } catch (e) {
      onToast('Алдаа: ' + adminErrorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id, code) => {
    if (deletingRef.current.has(code)) return;
    const ok = await confirm({
      title: `"${code}" кодыг устгах уу?`,
      confirmLabel: 'Устгах',
      danger: true,
    });
    if (!ok) return;
    deletingRef.current.add(code);
    setDeletingCode(code);
    try {
      await deleteInviteCode(code);
      await refresh();
      onToast('Код устгагдлаа');
      onLog(`Код устгагдлаа: ${code}`, 'warn');
    } catch (e) {
      onToast('Алдаа: ' + adminErrorText(e), true);
    } finally {
      deletingRef.current.delete(code);
      setDeletingCode((prev) => (prev === code ? null : prev));
    }
  };

  const handleCopy = async (code, id) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      onToast('Хуулж чадсангүй', true);
    }
  };

  const handleDownloadAvailable = async () => {
    setBusy(true);
    try {
      // When the loaded list was truncated, walk all pages so the export
      // covers every available code rather than silently dropping anything
      // past the first page.
      const all = invitesHasMore ? await listAllInviteCodes() : invites;
      const rows = all.filter(i => !i.used_by);
      if (rows.length === 0) {
        onToast('Татаж авах боломжит код алга', true);
        return;
      }
      const header = 'code,created_at,grants_admin\n';
      const body = rows
        .map(r => `${r.code},${r.created_at ?? ''},${r.grants_admin ? 'yes' : 'no'}`)
        .join('\n');
      // Prepend a UTF-8 BOM so Excel on Windows opens the CSV with the correct
      // codepage instead of treating it as ANSI (which mangles any future
      // Mongolian/Cyrillic content).
      const blob = new Blob(['﻿', header + body], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invite-codes-available-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(`${rows.length} код татагдлаа`);
      onLog(`${rows.length} боломжит код CSV-ээр татагдлаа`, 'ok');
    } catch (e) {
      onToast('Татахад алдаа: ' + adminErrorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  const available = invites.filter(i => !i.used_by).length;
  const used = invites.length - available;
  // "+" suffix on counts when the loaded list was truncated. The exact count
  // is unknown from the first page alone; admins should see "at least N".
  const moreSuffix = invitesHasMore ? '+' : '';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Нийт', value: `${invites.length}${moreSuffix}`, ico: '🎟️' },
          { label: 'Боломжит', value: `${available}${moreSuffix}`, ico: '🟢' },
          { label: 'Ашиглагдсан', value: `${used}${moreSuffix}`, ico: '✔️' },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-1">
            <span className="text-2xl">{s.ico}</span>
            <div className="font-cinzel text-xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground font-body">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-cinzel font-bold text-foreground">Кодын жагсаалт</h3>
            <p className="text-xs text-muted-foreground font-body">Нэг код → нэг данс үүсгэх эрх</p>
          </div>
          <Button
            onClick={handleDownloadAvailable}
            disabled={available === 0 || busy}
            variant="outline"
            className="gap-1.5 font-body text-sm border-gold/50 text-gold hover:bg-gold/10"
            title="Боломжит кодуудыг CSV-ээр татах"
          >
            <Download className="w-4 h-4" />
            Боломжит татах ({available}{moreSuffix})
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-body text-foreground">
            <input type="checkbox" checked={grantsAdmin} onChange={e => setGrantsAdmin(e.target.checked)} />
            <span>Админ эрх олгох</span>
          </label>
          <Button onClick={() => handleCreate(1)} disabled={busy} className="gap-1.5 font-body text-sm bg-gold text-background hover:bg-gold/90">
            <Plus className="w-4 h-4" />
            {busy ? 'Үүсгэж байна…' : 'Шинэ код үүсгэх'}
          </Button>
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <label className="flex items-center gap-2 text-xs font-body text-foreground">
              <span className="text-muted-foreground">Тоо</span>
              <input
                type="number"
                min={1}
                max={INVITE_BATCH_MAX}
                value={count}
                onChange={e => setCount(e.target.value)}
                className="w-24 bg-background border border-border rounded-md px-2 py-1 text-foreground text-sm"
              />
            </label>
            <Button
              onClick={() => handleCreate()}
              disabled={busy}
              variant="outline"
              className="gap-1.5 font-body text-sm border-gold/50 text-gold hover:bg-gold/10"
            >
              <Plus className="w-4 h-4" />
              {Number(count) > 1
                ? `${Math.min(INVITE_BATCH_MAX, Math.max(1, Math.floor(Number(count) || 1)))} код үүсгэх`
                : 'Дурын тоогоор үүсгэх'}
            </Button>
          </div>
          {[100, 500, 1000].map((n) => (
            <Button
              key={n}
              onClick={() => handleCreate(n)}
              disabled={busy}
              variant="outline"
              className="gap-1.5 font-body text-sm border-gold/50 text-gold hover:bg-gold/10"
            >
              <Plus className="w-4 h-4" /> {n}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {invites.length === 0 ? (
          <EmptyState
            icon={<Ticket className="w-8 h-8 text-muted-foreground/60" />}
            title="Кодын жагсаалт хоосон"
            description={'Шинэ урилгын код үүсгэхийн тулд "Шинэ код үүсгэх" товчийг ашиглаарай.'}
          />
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-normal">Код</th>
                <th className="text-left px-4 py-2 font-normal">Төлөв</th>
                <th className="text-left px-4 py-2 font-normal">Ашигласан</th>
                <th className="text-right px-4 py-2 font-normal">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => {
                const acc = inv.used_by ? accountById(inv.used_by) : null;
                const isUsed = !!inv.used_by;
                return (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono tracking-widest text-foreground">{inv.code}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={isUsed
                          ? 'border-muted text-muted-foreground'
                          : 'border-green-500/60 text-green-400'}
                      >
                        {isUsed ? 'Ашиглагдсан' : 'Боломжит'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {isUsed ? (
                        <div>
                          <div className="text-foreground">{acc?.username || '—'}</div>
                          <div className="text-muted-foreground">
                            {new Date(inv.used_at).toLocaleString('mn-MN')}
                          </div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {!isUsed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleCopy(inv.code, inv.id)}
                            title="Хуулах"
                          >
                            {copiedId === inv.id
                              ? <Check className="w-3.5 h-3.5 text-green-400" />
                              : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingCode === inv.code}
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(inv.id, inv.code)}
                          title="Устгах"
                        >
                          {deletingCode === inv.code
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground font-body">
        💡 Боломжит кодыг бусдад өгвөл тэд "Код ашиглах" хэсэгт оруулж, <strong>нэг</strong> данс үүсгэх боломжтой болно.
        Код ашиглагдсаны дараа дахин хэрэглэгдэхгүй.
      </p>
      {confirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders tab — list pre-orders submitted from the landing /order page,
// approve / mark shipped / cancel / delete. Reads via the `list-orders` edge
// function; mutations go through `update-order-status` and `delete-order`,
// which re-verify is_admin against the profiles table.
// ---------------------------------------------------------------------------

const TIER_LABEL = {
  basic: 'Энгийн',
  premium: 'Premium',
  collector: 'Collector',
};

const STATUS_META = {
  pending:   { label: 'Хүлээгдэж буй', cls: 'border-yellow-500/60 text-yellow-300' },
  confirmed: { label: 'Зөвшөөрсөн',    cls: 'border-green-500/60 text-green-300' },
  shipped:   { label: 'Илгээгдсэн',     cls: 'border-blue-500/60 text-blue-300' },
  cancelled: { label: 'Цуцалсан',       cls: 'border-red-500/60 text-red-300' },
};

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'shipped', 'cancelled'];

// `orders` / `setOrders` / `loading` / `onRefresh` are lifted into AdminPanel
// so the dashboard pending-count card and this tab share a single fetch.
// `hasMore` is forwarded so this tab's stat cards can render a "+" suffix
// when the loaded list was truncated by the per-request cap.
function OrdersTab({ orders, setOrders, hasMore, loading, onRefresh, onToast, onLog }) {
  const [filter, setFilter] = useState('pending');
  // Synchronous in-flight set blocks duplicate dispatches before React commits
  // the disabled state. The render-state Set mirrors it so EVERY in-flight
  // row renders visually disabled (a scalar busyId only tracked the last one).
  const inFlightRef = useRef(new Set());
  const [busyIds, setBusyIds] = useState(() => new Set());
  const { confirm, dialog: confirmDialog } = useConfirm();
  const isWide = useMediaQuery('(min-width: 1024px)');

  const beginBusy = (id) => {
    if (inFlightRef.current.has(id)) return false;
    inFlightRef.current.add(id);
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    return true;
  };
  const endBusy = (id) => {
    inFlightRef.current.delete(id);
    setBusyIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // `loading` and the canonical fetch are owned by AdminPanel; the refresh
  // button below routes through `onRefresh` so the same single source of truth
  // updates both the dashboard count and the table.

  const setStatus = async (id, nextStatus, verbForLog) => {
    if (!beginBusy(id)) return;
    // Snapshot just the affected row so a failure here doesn't roll back
    // any concurrent successful mutations on other rows.
    const original = orders.find(o => o.id === id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus } : o));
    try {
      await updateOrderStatus(id, nextStatus);
      onToast(`Төлөв шинэчлэгдлээ: ${STATUS_META[nextStatus].label}`);
      onLog(`Захиалга ${verbForLog}: #${id.slice(0, 6)}`, nextStatus === 'cancelled' ? 'warn' : 'ok');
    } catch (e) {
      setOrders(prev => prev.map(o => (o.id === id && original) ? original : o));
      onToast('Шинэчлэхэд алдаа: ' + adminErrorText(e), true);
    } finally {
      endBusy(id);
    }
  };

  const handleDelete = async (order) => {
    const ok = await confirm({
      title: `"${order.customer_name}" захиалгыг устгах уу?`,
      body: `${TIER_LABEL[order.tier] || order.tier} — ${order.customer_phone}`,
      confirmLabel: 'Устгах',
      danger: true,
    });
    if (!ok) return;
    if (!beginBusy(order.id)) return;
    // Capture the original index so reinsertion preserves position on rollback,
    // even if other rows changed concurrently.
    const indexBefore = orders.findIndex(o => o.id === order.id);
    setOrders(prev => prev.filter(o => o.id !== order.id));
    try {
      await deleteOrder(order.id);
      onToast('Захиалга устгагдлаа');
      onLog(`Захиалга устгагдлаа: ${order.customer_name}`, 'warn');
    } catch (e) {
      setOrders(prev => {
        if (prev.some(o => o.id === order.id)) return prev;
        const copy = [...prev];
        const at = indexBefore < 0 ? copy.length : Math.min(indexBefore, copy.length);
        copy.splice(at, 0, order);
        return copy;
      });
      onToast('Устгахад алдаа: ' + adminErrorText(e), true);
    } finally {
      endBusy(order.id);
    }
  };

  const counts = orders.reduce((acc, o) => {
    acc.total += 1;
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, { total: 0, pending: 0, confirmed: 0, shipped: 0, cancelled: 0 });
  // Append "+" to every count when the loaded list was truncated — admins
  // need to see "this is at least N", not a confidently-wrong exact number.
  const moreSuffix = hasMore ? '+' : '';

  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Бүгд',         value: `${counts.total}${moreSuffix}`,     ico: '📦' },
          { label: 'Хүлээгдэж буй', value: `${counts.pending}${moreSuffix}`,   ico: '🟡' },
          { label: 'Зөвшөөрсөн',   value: `${counts.confirmed}${moreSuffix}`, ico: '✅' },
          { label: 'Илгээгдсэн',   value: `${counts.shipped}${moreSuffix}`,   ico: '🚚' },
          { label: 'Цуцалсан',     value: `${counts.cancelled}${moreSuffix}`, ico: '⛔' },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 space-y-1">
            <span className="text-xl">{s.ico}</span>
            <div className="font-cinzel text-lg font-bold text-foreground">{s.value}</div>
            <div className="text-[11px] text-muted-foreground font-body">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Header / filter row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-cinzel font-bold text-foreground">Захиалгын жагсаалт</h3>
          <p className="text-xs text-muted-foreground font-body">
            /order хуудаснаас ирсэн захиалгууд. Зөвшөөрвөл "Confirmed" төлөвт шилжинэ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map(f => {
            const isActive = filter === f;
            const labelMap = { all: 'Бүгд', ...Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.label])) };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-body border transition-colors ${
                  isActive
                    ? 'bg-gold/20 border-gold text-gold'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-gold/40'
                }`}
              >
                {labelMap[f]}
                {f !== 'all' && counts[f] > 0 && (
                  <span className="ml-1.5 opacity-70">{counts[f]}</span>
                )}
              </button>
            );
          })}
          <Button
            onClick={onRefresh}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-1.5 font-body text-xs border-gold/50 text-gold hover:bg-gold/10"
            title="Сэргээх"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Сэргээх
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground font-body">Ачаалж байна…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-8 h-8 text-muted-foreground/60" />}
            title={filter === 'all' ? 'Захиалга байхгүй' : `"${(STATUS_META[filter]?.label) || filter}" төлөвтэй захиалга алга`}
            description={filter === 'all'
              ? '/order хуудаснаас захиалга ирэхэд энд харагдана.'
              : 'Бусад төлөвийг шалгахын тулд дээрх шүүлтүүрийг солино уу.'}
          />
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-normal">Огноо</th>
                <th className="text-left px-4 py-2 font-normal">Хэрэглэгч</th>
                <th className="text-left px-4 py-2 font-normal">Багц</th>
                <th className="text-left px-4 py-2 font-normal">Хаяг / Тэмдэглэл</th>
                <th className="text-left px-4 py-2 font-normal">Төлөв</th>
                <th className="text-right px-4 py-2 font-normal">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(o => {
                const meta = STATUS_META[o.status] || STATUS_META.pending;
                const isBusy = busyIds.has(o.id);
                return (
                  <tr key={o.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {o.created_at ? new Date(o.created_at).toLocaleString('mn-MN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{o.customer_name}</div>
                      <a href={`tel:${o.customer_phone}`} className="text-xs text-muted-foreground hover:text-gold">
                        {o.customer_phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {TIER_LABEL[o.tier] || o.tier}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                      <div className="whitespace-pre-wrap break-words">{o.customer_address}</div>
                      {o.notes && (
                        <div className="mt-1 italic opacity-80 whitespace-pre-wrap break-words">{o.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {isWide ? (
                      /* lg+: full inline cluster */
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {o.status === 'pending' && (
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() => setStatus(o.id, 'confirmed', 'зөвшөөрөгдлөө')}
                            className="h-7 text-xs bg-green-700 hover:bg-green-600 text-white gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Зөвшөөрөх
                          </Button>
                        )}
                        {(o.status === 'pending' || o.status === 'confirmed') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setStatus(o.id, 'shipped', 'илгээгдсэн')}
                            className="h-7 text-xs border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
                          >
                            🚚 Илгээсэн
                          </Button>
                        )}
                        {o.status !== 'cancelled' && o.status !== 'shipped' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setStatus(o.id, 'cancelled', 'цуцлагдлаа')}
                            className="h-7 text-xs border-red-500/40 text-red-300 hover:bg-red-500/10"
                          >
                            Цуцлах
                          </Button>
                        )}
                        {(o.status === 'cancelled' || o.status === 'shipped') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => setStatus(o.id, 'pending', 'буцаагдсан')}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Буцаах
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleDelete(o)}
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          title="Устгах"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      ) : (
                      /* <lg: primary action + overflow menu */
                      <div className="flex items-center justify-end gap-1.5">
                        {o.status === 'pending' && (
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() => setStatus(o.id, 'confirmed', 'зөвшөөрөгдлөө')}
                            className="h-7 text-xs bg-green-700 hover:bg-green-600 text-white gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Зөвшөөрөх
                          </Button>
                        )}
                        {o.status === 'confirmed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setStatus(o.id, 'shipped', 'илгээгдсэн')}
                            className="h-7 text-xs border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
                          >
                            🚚 Илгээсэн
                          </Button>
                        )}
                        {(o.status === 'shipped' || o.status === 'cancelled') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => setStatus(o.id, 'pending', 'буцаагдсан')}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Буцаах
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Илүү үйлдэл"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="font-body text-xs">
                            {o.status === 'pending' && (
                              <DropdownMenuItem onSelect={() => setStatus(o.id, 'shipped', 'илгээгдсэн')}>
                                🚚 Илгээсэн
                              </DropdownMenuItem>
                            )}
                            {(o.status === 'pending' || o.status === 'confirmed') && (
                              <DropdownMenuItem onSelect={() => setStatus(o.id, 'cancelled', 'цуцлагдлаа')} className="text-red-400 focus:text-red-300">
                                Цуцлах
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => handleDelete(o)} className="text-red-400 focus:text-red-300">
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Устгах
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground font-body">
        💡 Захиалга /order хуудаснаас ирдэг. "Зөвшөөрөх" товч төлөвийг <strong>confirmed</strong>-д шилжүүлнэ. Илгээгдсэн ба цуцалсан захиалгыг "Буцаах" товчоор хүлээгдэж буй төлөв рүү буцаах боломжтой.
      </p>
      {confirmDialog}
    </div>
  );
}

// Chip-input over a comma-separated string of fig_ids. Keeps the same value
// shape as the underlying form field so saveFig's existing parser still works
// — it just makes existing relations visible (with figure name lookup) and
// individually removable, instead of forcing the admin to hand-edit a single
// long line of comma-separated numbers.
function RelChipInput({ value, onChange, figures }) {
  const [draft, setDraft] = useState('');
  const ids = String(value ?? '')
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const addId = (raw) => {
    const n = parseInt(String(raw).trim());
    if (!Number.isInteger(n) || n <= 0) return;
    if (ids.includes(n)) return;
    onChange([...ids, n].join(', '));
    setDraft('');
  };
  const removeId = (n) => onChange(ids.filter((x) => x !== n).join(', '));

  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((n) => {
            const fig = figures.find((f) => f.fig_id === n);
            return (
              <span
                key={n}
                className="inline-flex items-center gap-1.5 bg-muted border border-border rounded-md px-2 py-0.5 text-xs font-body"
              >
                <span className="text-muted-foreground">#{n}</span>
                <span>{fig ? `${fig.ico ?? ''} ${fig.name}`.trim() : '—'}</span>
                <button
                  type="button"
                  onClick={() => removeId(n)}
                  className="ml-0.5 text-muted-foreground hover:text-red-400 leading-none text-base"
                  aria-label={`#${n} устгах`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); addId(draft); }}
        className="flex gap-2"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ID нэмэх (жишээ: 14)"
          type="number"
          min={1}
          className="bg-muted border-none text-sm font-body"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!draft.trim()}>
          Нэмэх
        </Button>
      </form>
    </div>
  );
}
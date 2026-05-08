import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIGURES, ERA_KEYS } from '@/lib/figuresData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { storyText } from '@/lib/i18n';
import { buildChapterPlaylist } from '@/lib/storyPlaylist';
import { adminErrorText } from '@/lib/adminErrors';

const LANGS = ['mn', 'en', 'cn'];

export default function AdminVoices({ onToast }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterQuoteOnly, setFilterQuoteOnly] = useState(true);
  const [editing, setEditing] = useState(null);
  const [preRenderingEra, setPreRenderingEra] = useState(null);
  const [preRenderProgress, setPreRenderProgress] = useState({ done: 0, total: 0 });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('figure_voices')
      .select('fig_id, lang, voice_id, sample_url');
    setLoading(false);
    if (error) { onToast('Ачаалахад алдаа: ' + adminErrorText(error), true); return; }
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const voiceMap = useMemo(() => {
    const m = new Map();
    for (const r of rows) m.set(`${r.fig_id}:${r.lang}`, r.voice_id);
    return m;
  }, [rows]);

  const sampleMap = useMemo(() => {
    const m = new Map();
    for (const r of rows) if (r.sample_url) m.set(`${r.fig_id}:${r.lang}`, r.sample_url);
    return m;
  }, [rows]);

  const visibleFigures = useMemo(() => {
    return FIGURES
      .filter((f) => !filterQuoteOnly || f.quote)
      .sort((a, b) => a.fig_id - b.fig_id);
  }, [filterQuoteOnly]);

  const save = async () => {
    if (!editing) return;
    const { fig_id, lang, voice_id } = editing;
    const trimmed = voice_id.trim();
    // Existing row's voice_id, if any. If admin is changing voice_id, the old
    // sample_url no longer matches the new voice — clear it so next preview
    // re-populates against the new voice.
    const previousVoiceId = voiceMap.get(`${fig_id}:${lang}`) ?? null;
    const voiceChanged = previousVoiceId !== null && previousVoiceId !== trimmed;
    const payload = { fig_id, lang, voice_id: trimmed, assigned_by: user?.id };
    if (voiceChanged) payload.sample_url = null;
    const { error } = await supabase
      .from('figure_voices')
      .upsert(payload, { onConflict: 'fig_id,lang' });
    if (error) { onToast('Хадгалахад алдаа: ' + adminErrorText(error), true); return; }
    onToast('Хадгалагдлаа');
    setEditing(null);
    // React-Query caches in useVoices(lang) and useFigureVoices(figId) have a
    // 5-minute staleTime; without explicit invalidation an admin's update
    // wouldn't reach narration/chat surfaces until then.
    queryClient.invalidateQueries({ queryKey: ['figure_voices'] });
    load();
  };

  const preview = async () => {
    if (!editing?.voice_id?.trim()) return;
    const figure = FIGURES.find((f) => f.fig_id === editing.fig_id);
    if (!figure) return;
    const sample = editing.lang === 'en'
      ? `I am ${figure.name}.`
      : editing.lang === 'cn'
        ? `我是${figure.name}。`
        : `Би бол ${figure.name}.`;
    const { data } = await supabase.functions.invoke('speak', {
      body: { text: sample, lang: editing.lang, voice_id: editing.voice_id.trim() },
    });
    if (!data?.url) { onToast('Preview боломжгүй', true); return; }
    new Audio(data.url).play();
    // Persist the cached sample URL so admins can replay it from the grid
    // without a second synth/HEAD round-trip. Best-effort — failure here is
    // non-blocking for the preview itself.
    const { error: updateError } = await supabase
      .from('figure_voices')
      .update({ sample_url: data.url })
      .eq('fig_id', editing.fig_id)
      .eq('lang', editing.lang);
    if (!updateError) {
      setRows((prev) => {
        const existing = prev.find((r) => r.fig_id === editing.fig_id && r.lang === editing.lang);
        if (existing) {
          return prev.map((r) =>
            r.fig_id === editing.fig_id && r.lang === editing.lang
              ? { ...r, sample_url: data.url }
              : r,
          );
        }
        return [...prev, {
          fig_id: editing.fig_id,
          lang: editing.lang,
          voice_id: editing.voice_id.trim(),
          sample_url: data.url,
        }];
      });
    }
  };

  const playSample = (figId, lang) => {
    const url = sampleMap.get(`${figId}:${lang}`);
    if (!url) return;
    new Audio(url).play().catch(() => onToast('Тоглуулах боломжгүй', true));
  };

  // Close the editor on ESC (only when it's open). Skip when focus is in an
  // input — Voices' single field is a text input the user might want to
  // clear with ESC; restrict to body-level keys.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      const target = e.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      setEditing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const preRenderChapter = async (era) => {
    setPreRenderingEra(era);
    const playlist = buildChapterPlaylist(era);
    const activeLangs = LANGS;
    setPreRenderProgress({ done: 0, total: playlist.length * activeLangs.length });
    for (const slide of playlist) {
      for (const lang of activeLangs) {
        const text = slide.kind === 'figure'
          ? storyText(slide.figure, lang)
          : slide.kind === 'intro'
            ? `${era} intro.`
            : `${era} outro.`;
        const vid = slide.kind === 'figure' ? voiceMap.get(`${slide.figure.fig_id}:${lang}`) : null;
        const body = { text, lang };
        if (vid) body.voice_id = vid;
        try { await supabase.functions.invoke('speak', { body }); } catch { /* ignore */ }
        setPreRenderProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    setPreRenderingEra(null);
    onToast(`Бүлэг ${era} бэлтгэгдлээ.`);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground font-body p-6">Ачаалж байна…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-cinzel text-base font-bold">Дуу хоолой</h3>
        <label className="flex items-center gap-2 text-xs font-body">
          <input
            type="checkbox"
            checked={filterQuoteOnly}
            onChange={(e) => setFilterQuoteOnly(e.target.checked)}
          />
          Ишлэлтэй
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {ERA_KEYS.map((era) => (
          <Button
            key={era}
            size="sm"
            variant="outline"
            onClick={() => preRenderChapter(era)}
            disabled={preRenderingEra !== null}
          >
            {preRenderingEra === era
              ? `Бэлтгэж байна… ${preRenderProgress.done}/${preRenderProgress.total}`
              : `Бүлэг ${era} бэлтгэх`}
          </Button>
        ))}
      </div>

      <table className="w-full text-sm font-body">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="py-2 pr-4">Зүтгэлтэн</th>
            {LANGS.map((l) => <th key={l} className="py-2 px-3">{l.toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {visibleFigures.map((f) => (
            <tr key={f.fig_id} className="border-b border-border/50">
              <td className="py-2 pr-4">{f.fig_id}. {f.name}</td>
              {LANGS.map((lang) => {
                const vid = voiceMap.get(`${f.fig_id}:${lang}`);
                const hasSample = sampleMap.has(`${f.fig_id}:${lang}`);
                return (
                  <td key={lang} className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditing({ fig_id: f.fig_id, lang, voice_id: vid ?? '' })}
                        className="text-xs underline decoration-dotted text-muted-foreground hover:text-foreground"
                      >
                        {vid ? `🎙 ${vid.slice(0, 8)}…` : '— оноох —'}
                      </button>
                      {hasSample && (
                        <button
                          type="button"
                          onClick={() => playSample(f.fig_id, lang)}
                          aria-label={`Play sample (fig ${f.fig_id}, ${lang})`}
                          title="Сонсох"
                          className="text-xs text-brass/70 hover:text-foreground"
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[400] bg-background/80 flex items-center justify-center p-6"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-cinzel text-sm">
              fig {editing.fig_id} · {editing.lang.toUpperCase()}
            </h4>
            <Input
              autoFocus
              value={editing.voice_id}
              onChange={(e) => setEditing({ ...editing, voice_id: e.target.value })}
              placeholder="ElevenLabs voice_id"
            />
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Болих</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={preview}
                        disabled={!editing.voice_id.trim()}>
                  Сонсох
                </Button>
                <Button size="sm" onClick={save}
                        disabled={!editing.voice_id.trim()}>
                  Хадгалах
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

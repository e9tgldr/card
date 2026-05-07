import { useEffect, useMemo, useState } from 'react';
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
      .select('fig_id, lang, voice_id');
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

  const visibleFigures = useMemo(() => {
    return FIGURES
      .filter((f) => !filterQuoteOnly || f.quote)
      .sort((a, b) => a.fig_id - b.fig_id);
  }, [filterQuoteOnly]);

  const save = async () => {
    if (!editing) return;
    const { fig_id, lang, voice_id } = editing;
    const { error } = await supabase
      .from('figure_voices')
      .upsert(
        { fig_id, lang, voice_id: voice_id.trim(), assigned_by: user?.id },
        { onConflict: 'fig_id,lang' },
      );
    if (error) { onToast('Хадгалахад алдаа: ' + adminErrorText(error), true); return; }
    onToast('Хадгалагдлаа');
    setEditing(null);
    load();
  };

  const preview = async () => {
    if (!editing?.voice_id?.trim()) return;
    const figure = FIGURES.find((f) => f.fig_id === editing.fig_id);
    if (!figure) return;
    const sample = editing.lang === 'en'
      ? `I am ${figure.name}.`
      : `Би бол ${figure.name}.`;
    const { data } = await supabase.functions.invoke('speak', {
      body: { text: sample, lang: editing.lang, voice_id: editing.voice_id.trim() },
    });
    if (data?.url) new Audio(data.url).play();
    else onToast('Preview боломжгүй', true);
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
    const activeLangs = ['mn', 'en'];
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
                return (
                  <td key={lang} className="py-2 px-3">
                    <button
                      onClick={() => setEditing({ fig_id: f.fig_id, lang, voice_id: vid ?? '' })}
                      className="text-xs underline decoration-dotted text-muted-foreground hover:text-foreground"
                    >
                      {vid ? `🎙 ${vid.slice(0, 8)}…` : '— оноох —'}
                    </button>
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

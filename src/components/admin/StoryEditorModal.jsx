import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export default function StoryEditorModal({ figure, onClose, onToast }) {
  const { user } = useAuth();
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const slug = `figure:${figure.fig_id}`;
      const { data, error } = await supabase
        .from('story_content')
        .select('lang, text, status')
        .eq('slug', slug);
      setLoading(false);
      if (error) { onToast('Ачаалахад алдаа: ' + error.message, true); return; }
      const next = { mn: { text: '', status: 'draft' }, en: { text: '', status: 'draft' } };
      for (const r of data ?? []) next[r.lang] = { text: r.text, status: r.status };
      setRows(next);
    })();
  }, [figure.fig_id, onToast]);

  const saveLang = async (lang, nextStatus) => {
    setSaving(true);
    const row = rows[lang];
    const status = nextStatus ?? row.status;
    const { error } = await supabase.from('story_content').upsert(
      {
        slug: `figure:${figure.fig_id}`,
        lang,
        text: row.text,
        status,
        updated_by: user?.id,
      },
      { onConflict: 'slug,lang' },
    );
    setSaving(false);
    if (error) { onToast('Хадгалахад алдаа: ' + error.message, true); return; }
    setRows((prev) => ({ ...prev, [lang]: { ...prev[lang], status } }));
    onToast(status === 'published' ? 'Нийтлэгдлээ' : 'Хадгалагдлаа');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[400] bg-background/80 flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-xl p-6">Ачаалж байна…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[400] bg-background/80 flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-cinzel font-bold">Түүх · {figure.name}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Хаах</Button>
        </div>

        {(['mn', 'en']).map((lang) => {
          const row = rows[lang];
          const isPublished = row.status === 'published';
          return (
            <div key={lang} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-meta text-[11px] tracking-[0.2em] uppercase text-brass/80">
                  Түүх · {lang.toUpperCase()}
                </label>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  isPublished ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'
                }`}>
                  {isPublished ? 'Нийтлэгдсэн' : 'Ноорог'}
                </span>
              </div>
              <Textarea
                rows={10}
                value={row.text}
                onChange={(e) => setRows((p) => ({ ...p, [lang]: { ...p[lang], text: e.target.value } }))}
                placeholder="Түүхийн текст…"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground font-body">
                  {row.text.length} тэмдэгт · ~{Math.round(row.text.length / 15)}с
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => saveLang(lang)}>
                    Хадгалах
                  </Button>
                  {isPublished ? (
                    <Button variant="outline" size="sm" disabled={saving} onClick={() => saveLang(lang, 'draft')}>
                      Нийтлэлээс авах
                    </Button>
                  ) : (
                    <Button size="sm" disabled={saving || !row.text.trim()} onClick={() => saveLang(lang, 'published')}>
                      Нийтлэх
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

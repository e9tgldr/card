import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CATEGORIES } from '@/lib/figuresData';
import { useLang, figureName, figureRole, figureBio, figureAchievements, figureFact, figureQuote } from '@/lib/i18n';
import { base44, LLM_UNAVAILABLE_MSG } from '@/api/base44Client';
import { compareLocally } from '@/lib/compareLocal';

function FigureColumn({ figure }) {
  const cat = CATEGORIES[figure.cat];
  const { lang } = useLang();
  const achs = figureAchievements(figure, lang);
  const fact = figureFact(figure, lang);
  const { quote } = figureQuote(figure, lang);
  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <div
        className="rounded-xl p-4 text-center space-y-2"
        style={{ background: `linear-gradient(135deg, ${cat?.color}33, ${cat?.color}55)` }}
      >
        <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden border-2 flex items-center justify-center text-3xl"
          style={{ borderColor: cat?.color, background: `${cat?.color}33` }}
        >
          {figure.front_img
            ? <img src={figure.front_img} alt={figure.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
            : <span>{figure.ico}</span>
          }
        </div>
        <div>
          <Badge style={{ background: cat?.color, color: 'white' }} className="text-[10px] mb-1">
            {cat?.ico} {lang === 'en' ? (cat?.label_en || cat?.label) : cat?.label}
          </Badge>
          <h3 className="font-cinzel font-bold text-foreground text-sm leading-tight">{figureName(figure, lang)}</h3>
          <p className="text-xs text-muted-foreground font-body">{figure.yrs}</p>
        </div>
      </div>

      {/* Role */}
      <div className="space-y-1">
        <h4 className="font-cinzel text-[10px] tracking-widest text-gold uppercase">{lang === 'en' ? 'Role' : 'Үүрэг'}</h4>
        <p className="text-xs font-body text-foreground/90 bg-muted/40 rounded-lg p-2">{figureRole(figure, lang)}</p>
      </div>

      {/* Bio snippet */}
      <div className="space-y-1">
        <h4 className="font-cinzel text-[10px] tracking-widest text-gold uppercase">{lang === 'en' ? 'Biography' : 'Намтар'}</h4>
        <p className="text-xs font-body text-foreground/80 leading-relaxed line-clamp-5">{figureBio(figure, lang)}</p>
      </div>

      {/* Achievements */}
      {achs?.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="font-cinzel text-[10px] tracking-widest text-gold uppercase">
            {lang === 'en' ? 'Achievements' : 'Гавьяа'} ({achs.length})
          </h4>
          <ul className="space-y-1.5">
            {achs.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-body text-foreground/85">
                <span className="text-crimson mt-0.5 flex-shrink-0">▸</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quote */}
      {quote && (
        <blockquote className="border-l-2 border-crimson pl-3 py-1 italic">
          <p className="text-xs font-body text-foreground/70">"{quote}"</p>
        </blockquote>
      )}

      {/* Fact */}
      {fact && (
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
          <p className="text-[10px] font-cinzel text-gold tracking-wider mb-1">💡 {lang === 'en' ? 'FACT' : 'БАРИМТ'}</p>
          <p className="text-xs font-body text-foreground/80">{fact}</p>
        </div>
      )}
    </div>
  );
}

export default function CompareModal({ figures, compareList, onClose }) {
  const selected = compareList.map(id => figures.find(f => f.fig_id === id)).filter(Boolean);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const { lang } = useLang();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const generateAISummary = async () => {
    setAiLoading(true);
    setShowAI(true);

    // Always compute the local fallback first — it's instant and guarantees
    // that the user sees something even if the cloud LLM is stubbed/offline.
    const localResult = compareLocally(selected, lang);

    try {
      const figuresSummary = selected.map(f =>
        `${figureName(f, lang)} (${f.yrs}): ${figureRole(f, lang)}. ${lang === 'en' ? 'Achievements' : 'Гавьяа'}: ${(figureAchievements(f, lang) || []).join('; ')}.`
      ).join('\n\n');

      const isEn = lang === 'en';
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: isEn
          ? `Compare these Mongolian historical figures. Reply in English. Keep it concise and interesting:\n\n${figuresSummary}`
          : `Дараах Монголын түүхэн зүтгэлтнүүдийг харьцуул. Монгол хэлээр хариул. Товч бөгөөд сонирхолтой байлга:\n\n${figuresSummary}`,
        response_json_schema: {
          type: 'object',
          properties: {
            similarities: { type: 'array', items: { type: 'string' }, description: isEn ? '3-4 similarities in English' : '3-4 similarities in Mongolian' },
            differences:  { type: 'array', items: { type: 'string' }, description: isEn ? '3-4 key differences in English' : '3-4 key differences in Mongolian' },
            overall:      { type: 'string', description: isEn ? '2-3 sentence overall comparison in English' : '2-3 sentence overall comparison in Mongolian' },
          }
        }
      });

      // Detect the local-stub response (overall === LLM_UNAVAILABLE_MSG, or empty arrays).
      const stubbed =
        !res ||
        res.overall === LLM_UNAVAILABLE_MSG ||
        ((!res.similarities || res.similarities.length === 0) &&
         (!res.differences || res.differences.length === 0));

      if (stubbed) {
        setAiSummary({ ...localResult, source: 'local' });
      } else {
        setAiSummary({ ...res, source: 'ai' });
      }
    } catch (e) {
      console.warn('CompareModal AI failed, using local fallback:', e);
      setAiSummary({ ...localResult, source: 'local' });
    }
    setAiLoading(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-card border border-border rounded-2xl w-full max-w-5xl h-[92vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              <h2 className="font-cinzel font-bold text-foreground">{lang === 'en' ? 'Comparison' : 'Харьцуулалт'}</h2>
              <Badge variant="outline" className="border-gold text-gold font-body text-[10px]">
                {selected.length} {lang === 'en' ? 'figures' : 'зүтгэлтэн'}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-6">
              {/* Side-by-side columns */}
              <div className="flex gap-4 overflow-x-auto pb-2 min-h-0">
                {selected.map((fig, i) => (
                  <div key={fig.fig_id} className="flex gap-4 flex-1 min-w-[200px]">
                    {i > 0 && <div className="w-px bg-border flex-shrink-0" />}
                    <FigureColumn figure={fig} />
                  </div>
                ))}
              </div>

              {/* AI Section */}
              <div className="border-t border-border pt-5">
                {!showAI ? (
                  <Button
                    onClick={generateAISummary}
                    className="w-full bg-crimson hover:bg-crimson/90 text-white font-body gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {lang === 'en' ? 'Generate AI comparison' : 'AI-аар харьцуулалт хийх'}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="w-4 h-4 text-gold" />
                      <h3 className="font-cinzel text-sm font-bold text-gold">{lang === 'en' ? 'AI Comparison' : 'AI Харьцуулалт'}</h3>
                      {aiSummary?.source === 'local' && (
                        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground border border-muted-foreground/40 px-1.5 py-0.5 rounded">
                          {lang === 'en' ? 'local mode' : 'локал горим'}
                        </span>
                      )}
                    </div>
                    {aiSummary?.source === 'local' && (
                      <p className="text-[11px] text-muted-foreground font-body italic">
                        {lang === 'en'
                          ? 'AI service is offline; showing data-driven comparison from the collection.'
                          : 'AI үйлчилгээ идэвхгүй байна; цуглуулгын өгөгдөлд тулгуурласан харьцуулалтыг үзүүлж байна.'}
                      </p>
                    )}

                    {aiLoading ? (
                      <div className="flex items-center justify-center py-8 gap-3">
                        <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground font-body">
                          {lang === 'en' ? 'Analysing with AI…' : 'AI дүн шинжилгээ хийж байна…'}
                        </span>
                      </div>
                    ) : aiSummary?.error ? (
                      <p className="text-sm text-destructive font-body">{aiSummary.error}</p>
                    ) : aiSummary ? (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Similarities */}
                        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
                          <h4 className="font-cinzel text-xs font-semibold text-green-400 tracking-wider">✦ {lang === 'en' ? 'SIMILARITIES' : 'ИЖИЛ ТАЛУУД'}</h4>
                          <ul className="space-y-1.5">
                            {aiSummary.similarities?.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs font-body text-foreground/85">
                                <span className="text-green-400 flex-shrink-0 mt-0.5">•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Differences */}
                        <div className="rounded-xl border border-crimson/20 bg-crimson/5 p-4 space-y-2">
                          <h4 className="font-cinzel text-xs font-semibold text-crimson tracking-wider">✦ {lang === 'en' ? 'DIFFERENCES' : 'ЯЛГААТАЙ ТАЛУУД'}</h4>
                          <ul className="space-y-1.5">
                            {aiSummary.differences?.map((d, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs font-body text-foreground/85">
                                <span className="text-crimson flex-shrink-0 mt-0.5">•</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Overall */}
                        {aiSummary.overall && (
                          <div className="sm:col-span-2 rounded-xl border border-gold/20 bg-gold/5 p-4">
                            <h4 className="font-cinzel text-xs font-semibold text-gold tracking-wider mb-2">✦ {lang === 'en' ? 'OVERALL' : 'НИЙТ ДҮГНЭЛТ'}</h4>
                            <p className="text-sm font-body text-foreground/90 leading-relaxed">{aiSummary.overall}</p>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!aiLoading && aiSummary && !aiSummary.error && (
                      <Button variant="outline" size="sm" className="font-body text-xs gap-1.5" onClick={generateAISummary}>
                        <Sparkles className="w-3.5 h-3.5" />
                        {lang === 'en' ? 'Regenerate' : 'Дахин үүсгэх'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
import { useEffect, useCallback, useState } from 'react';
import { X, MessageCircle, Clock, BookOpen, Users, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CATEGORIES, FIGURES } from '@/lib/figuresData';
import { useLang, figureName, figureRole, figureBio, figureAchievements, figureFact, figureQuote } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import FigureTimeline from './FigureTimeline';

const TABS = [
  { key: 'bio',      labelKey: 'fd.tab.bio',      icon: BookOpen },
  { key: 'timeline', labelKey: 'fd.tab.timeline', icon: Clock },
  { key: 'related',  labelKey: 'fd.tab.related',  icon: Users },
];

export default function FigureModal({ figure, onClose, onSelectFigure, onAskAI, isInTeam, onToggleTeam }) {
  const [tab, setTab] = useState('bio');
  const cat = CATEGORIES[figure?.cat];
  const { t, lang } = useLang();

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    setTab('bio');
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown, figure?.fig_id]);

  if (!figure) return null;

  const relatedFigures = (figure.rel || [])
    .map(id => FIGURES.find(f => f.fig_id === id))
    .filter(Boolean);

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
          className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Hero */}
          <div
            className="relative flex-shrink-0 h-48 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${cat?.color}44, ${cat?.color}88)` }}
          >
            {figure.front_img ? (
              <img
                src={figure.front_img}
                alt={figure.name}
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl">{figure.ico}</span>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/20" />

            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full z-10"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
            {/* Team toggle */}
            {onToggleTeam && (
              <button
                onClick={() => onToggleTeam(figure.fig_id)}
                className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body transition-all shadow-md ${
                  isInTeam
                    ? 'bg-crimson text-white'
                    : 'bg-black/40 text-white hover:bg-crimson/80'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isInTeam ? 'fill-white' : ''}`} />
                {isInTeam ? t('fd.inTeam') : t('fd.addToTeam')}
              </button>
            )}

            {/* Header info overlay */}
            <div className="absolute bottom-3 left-4 right-4 z-10">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge style={{ background: cat?.color, color: 'white' }} className="text-xs">
                  {cat?.ico} {lang === 'en' ? (cat?.label_en || cat?.label) : cat?.label}
                </Badge>
                <Badge variant="outline" className="border-gold text-gold font-cinzel text-xs">
                  {figure.card}
                </Badge>
              </div>
              <h2 className="font-cinzel text-xl font-bold text-white drop-shadow">{figureName(figure, lang)}</h2>
              <p className="text-white/70 font-body text-xs">{figure.yrs} • {figureRole(figure, lang)}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-shrink-0 flex border-b border-border bg-card/60">
            {TABS.map((tab_) => {
              const Icon = tab_.icon;
              return (
                <button
                  key={tab_.key}
                  onClick={() => setTab(tab_.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-body transition-all border-b-2 ${
                    tab === tab_.key
                      ? 'border-gold text-gold font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t(tab_.labelKey)}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-6">

              {/* BIO TAB */}
              {tab === 'bio' && (
                <>
                  {/* Bio */}
                  <div className="space-y-1.5">
                    <h3 className="font-cinzel text-xs font-semibold text-gold tracking-wider">{t('fd.section.bio').toUpperCase()}</h3>
                    <p className="text-foreground/90 font-body text-sm leading-relaxed">{figureBio(figure, lang)}</p>
                  </div>

                  {/* Achievements */}
                  {(() => {
                    const achs = figureAchievements(figure, lang);
                    if (!achs?.length) return null;
                    return (
                      <div className="space-y-2">
                        <h3 className="font-cinzel text-xs font-semibold text-gold tracking-wider">{t('fd.section.achs').toUpperCase()}</h3>
                        <div className="space-y-2">
                          {achs.map((a, i) => (
                            <div key={i} className="flex items-start gap-3 pl-3 border-l-2 border-crimson">
                              <span className="text-foreground/90 font-body text-sm">{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Fact */}
                  {(() => {
                    const fact = figureFact(figure, lang);
                    if (!fact) return null;
                    return (
                      <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
                        <h3 className="font-cinzel text-xs font-semibold text-gold tracking-wider mb-1.5">💡 {t('fd.section.fact').toUpperCase()}</h3>
                        <p className="text-foreground/85 font-body text-sm">{fact}</p>
                      </div>
                    );
                  })()}

                  {/* Quote */}
                  {(() => {
                    const { quote, qattr } = figureQuote(figure, lang);
                    if (!quote) return null;
                    return (
                      <blockquote className="border-l-4 border-crimson pl-4 py-2 italic">
                        <p className="text-foreground/80 font-body text-sm">"{quote}"</p>
                        {qattr && (
                          <cite className="text-muted-foreground text-xs mt-1 block">— {qattr}</cite>
                        )}
                      </blockquote>
                    );
                  })()}

                  {/* AI Button */}
                  <Button
                    onClick={() => onAskAI(figure)}
                    className="w-full bg-crimson hover:bg-crimson/90 text-white font-body gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {lang === 'en' ? 'Ask AI' : 'AI-аас Асуух'}
                  </Button>
                </>
              )}

              {/* TIMELINE TAB */}
              {tab === 'timeline' && (
                <FigureTimeline figure={figure} />
              )}

              {/* RELATED TAB */}
              {tab === 'related' && (
                <div className="space-y-4">
                  {relatedFigures.length > 0 ? (
                    <>
                      <h3 className="font-cinzel text-xs font-semibold text-gold tracking-wider">{t('fd.section.related').toUpperCase()}</h3>
                      <div className="grid gap-3">
                        {relatedFigures.map(rf => {
                          const rfCat = CATEGORIES[rf.cat];
                          return (
                            <button
                              key={rf.fig_id}
                              onClick={() => onSelectFigure(rf)}
                              className="flex items-center gap-4 p-3 bg-muted/50 hover:bg-muted rounded-xl border border-border hover:border-gold/40 transition-all text-left group"
                            >
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                                style={{ background: `${rfCat?.color}33` }}
                              >
                                {rf.ico}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-cinzel text-sm font-bold text-foreground group-hover:text-gold transition-colors truncate">{figureName(rf, lang)}</p>
                                <p className="text-xs text-muted-foreground font-body">{rf.yrs}</p>
                                <p className="text-xs text-muted-foreground font-body truncate">{figureRole(rf, lang)}</p>
                              </div>
                              <Badge style={{ background: rfCat?.color, color: 'white' }} className="text-[10px] flex-shrink-0">
                                {rfCat?.ico}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground font-body text-sm">
                      {lang === 'en' ? 'No connected figures found' : 'Холбогдох хүмүүс олдсонгүй'}
                    </div>
                  )}

                  {/* Category peers */}
                  <div className="pt-2 border-t border-border">
                    <h3 className="font-cinzel text-xs font-semibold text-muted-foreground tracking-wider mb-3">{t('fd.section.sameCat').toUpperCase()}</h3>
                    <div className="flex flex-wrap gap-2">
                      {FIGURES.filter(f => f.cat === figure.cat && f.fig_id !== figure.fig_id).slice(0, 6).map(f => (
                        <button
                          key={f.fig_id}
                          onClick={() => onSelectFigure(f)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-full text-xs font-body hover:border-gold/50 transition-colors"
                        >
                          <span>{f.ico}</span>
                          <span className="text-foreground">{figureName(f, lang)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
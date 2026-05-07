import { Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@/lib/figuresData';
import { useLang, figureName } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import SealMark from '@/components/ornaments/SealMark';
import CornerTicks from '@/components/ornaments/CornerTicks';
import CategoryGlyph from '@/components/ornaments/CategoryGlyph';
import { useConfirm } from '@/components/ui/use-confirm';

export default function MyTeamSection({ figures, team, onRemove, onClear }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const teamFigures = team.map(id => figures.find(f => f.fig_id === id)).filter(Boolean);
  if (team.length === 0) return null;

  const catCounts = {};
  teamFigures.forEach(f => { catCounts[f.cat] = (catCounts[f.cat] || 0) + 1; });

  return (
    <section className="relative py-14 px-4 border-y border-brass/30">
      <div className="max-w-[84rem] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="w-11 h-11 flex items-center justify-center border border-brass/50 bg-ink/60 relative">
              <CornerTicks size={7} inset={3} thickness={1} opacity={0.85} />
              <SealMark size={22} variant="filled" pulse />
            </span>
            <div>
              <span className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass/85">
                {t('team.label')}
              </span>
              <h2
                className="font-display text-2xl md:text-3xl text-ivory leading-none mt-1"
                style={{ fontVariationSettings: '"opsz" 48, "SOFT" 60' }}
              >
                {t('team.title.prefix')} <span className="text-seal">{t('team.title.suffix')}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Category tally */}
            <div className="hidden md:flex items-center gap-3">
              {Object.entries(catCounts).map(([cat, count]) => {
                const ci = CATEGORIES[cat];
                return (
                  <span
                    key={cat}
                    className="flex items-center gap-1.5 px-2 py-1 border text-[10px] font-meta tracking-[0.18em] uppercase"
                    style={{ borderColor: ci?.color, color: 'hsl(var(--ivory)/0.9)', background: `${ci?.color}18` }}
                  >
                    <CategoryGlyph cat={cat} size={12} className="text-brass" />
                    <span className="text-ivory">{String(count).padStart(2, '0')}</span>
                  </span>
                );
              })}
            </div>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-2 border border-brass/40 hover:border-brass text-brass transition-colors"
              title={collapsed ? 'Нээх' : 'Хаах'}
              aria-label={collapsed ? 'Нээх' : 'Хаах'}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: t('team.clearConfirm'),
                  confirmLabel: 'Цэвэрлэх',
                  danger: true,
                });
                if (ok) onClear();
              }}
              className="p-2 border border-brass/40 hover:border-seal hover:text-seal text-brass transition-colors"
              title={t('team.clearConfirm')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {teamFigures.map((fig) => {
                  const cat = CATEGORIES[fig.cat];
                  const pad = String(fig.fig_id).padStart(2, '0');
                  return (
                    <motion.div
                      key={fig.fig_id}
                      layout
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      className="relative group cursor-pointer"
                      onClick={() => navigate(`/figure/${fig.fig_id}`)}
                    >
                      <div className="relative overflow-hidden border border-brass/30 group-hover:border-brass/75 transition-colors bg-card"
                           style={{ aspectRatio: '3 / 4' }}>
                        <CornerTicks size={7} inset={3} thickness={1} opacity={0.75} />
                        <div
                          className="absolute inset-0"
                          style={{ background: `linear-gradient(155deg, ${cat?.color} 0%, #0e0b07 90%)` }}
                        />
                        {fig.front_img ? (
                          <img
                            src={fig.front_img}
                            alt={fig.name}
                            crossOrigin="anonymous"
                            className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-90"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CategoryGlyph cat={fig.cat} size={44} className="text-ivory/40" />
                          </div>
                        )}
                        <span
                          aria-hidden
                          className="absolute inset-0 mix-blend-multiply opacity-65"
                          style={{ background: `linear-gradient(155deg, ${cat?.color}dd, #0e0b07 95%)` }}
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-transparent" />

                        <span className="absolute top-2 left-2 font-meta text-[9px] tracking-[0.22em] text-ivory/90 bg-ink/60 px-1 py-0.5 border border-brass/40">
                          N° {pad}
                        </span>

                        <div className="absolute bottom-2 left-2 right-2">
                          <p
                            className="font-display text-[13px] text-ivory leading-tight line-clamp-1"
                            style={{ fontVariationSettings: '"opsz" 30, "SOFT" 50' }}
                          >
                            {figureName(fig, lang)}
                          </p>
                          <p className="font-meta text-[8.5px] tracking-[0.14em] text-brass/85 mt-0.5">{fig.yrs}</p>
                        </div>
                        <span
                          aria-hidden
                          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px]"
                          style={{ background: `linear-gradient(90deg, ${cat?.color}, transparent 70%)` }}
                        />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(fig.fig_id); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-seal border border-brass/80 text-ivory flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        aria-label="Багаас хасах"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {confirmDialog}
    </section>
  );
}

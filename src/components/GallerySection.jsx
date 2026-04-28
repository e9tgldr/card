import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Layers, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CATEGORIES, ERAS, ERA_KEYS, getEra } from '@/lib/figuresData';
import { useLang } from '@/lib/i18n';
import FigureCard from './FigureCard';
import Card3D from './Card3D';
import Fleuron from '@/components/ornaments/Fleuron';
import CategoryGlyph from '@/components/ornaments/CategoryGlyph';
import CodexRule from '@/components/ornaments/CodexRule';
import { useFigureBackVideos, mergeBackVideos } from '@/hooks/useFigureBackVideos';

const FILTER_OPTIONS = [
  { key: 'all',       label: 'Бүгд',    label_en: 'All',        roman: '∑' },
  { key: 'khans',     label: 'Хаад',    label_en: 'Khans',      roman: 'I' },
  { key: 'queens',    label: 'Хатад',   label_en: 'Khatuns',    roman: 'II' },
  { key: 'warriors',  label: 'Дайчид',  label_en: 'Warriors',   roman: 'III' },
  { key: 'political', label: 'Төрийн',  label_en: 'Ministers',  roman: 'IV' },
  { key: 'cultural',  label: 'Соёлын',  label_en: 'Sages',      roman: 'V' },
];

export default function GallerySection({ figures, onCardClick, isInTeam, onToggleTeam, isInCompare, onToggleCompare }) {
  const [filter, setFilter] = useState('all');
  const [eraFilter, setEraFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view3D, setView3D] = useState(false);
  const containerRef = useRef(null);
  const { t, lang } = useLang();

  const { data: videosById } = useFigureBackVideos();
  const figuresWithVideos = useMemo(
    () => mergeBackVideos(figures, videosById),
    [figures, videosById],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Reveal animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    const cards = containerRef.current?.querySelectorAll('.reveal');
    cards?.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, [filter, eraFilter, debouncedSearch]);

  const filtered = useMemo(() => {
    let list = figuresWithVideos;
    if (filter !== 'all') list = list.filter(f => f.cat === filter);
    if (eraFilter !== 'all') list = list.filter(f => getEra(f) === eraFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.role.toLowerCase().includes(q) ||
        f.bio.toLowerCase().includes(q)
      );
    }
    return list;
  }, [figuresWithVideos, filter, eraFilter, debouncedSearch]);

  // Group by category
  const grouped = useMemo(() => {
    if (filter !== 'all') return { [filter]: filtered };
    const groups = {};
    filtered.forEach(f => {
      if (!groups[f.cat]) groups[f.cat] = [];
      groups[f.cat].push(f);
    });
    return groups;
  }, [filtered, filter]);

  return (
    <section className="relative py-24 px-4" ref={containerRef}>
      {/* Section heading — editorial */}
      <div className="max-w-[84rem] mx-auto">
        <div className="text-center space-y-5 mb-14">
          <CodexRule caption={t('codex.chapter.II')} fleuronSize={22} />
          <h2 className="display-title text-[clamp(2.4rem,5vw,4.5rem)] text-ivory">
            {t('gallery.title.prefix')} <span className="text-seal">{t('gallery.title.suffix')}</span>
          </h2>
          <p className="max-w-xl mx-auto prose-body italic text-ivory/70">
            {t('gallery.subtitle')}
          </p>
        </div>

        {/* Filter + search bar — catalog style (not pills) */}
        <div className="relative border-y border-brass/30 py-4 mb-12">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {FILTER_OPTIONS.map((opt, i) => {
                const active = filter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className="group flex items-baseline gap-2 py-1 relative"
                  >
                    <span
                      className={`font-meta text-[9px] tracking-[0.3em] ${
                        active ? 'text-seal' : 'text-brass/55 group-hover:text-brass'
                      } transition-colors`}
                    >
                      {opt.roman}.
                    </span>
                    <span
                      className={`font-display text-sm transition-colors ${
                        active ? 'text-ivory' : 'text-ivory/60 group-hover:text-ivory'
                      }`}
                      style={{ fontVariationSettings: '"opsz" 30, "SOFT" 50' }}
                    >
                      {lang === 'en' ? opt.label_en : opt.label}
                    </span>
                    {active && (
                      <span className="absolute -bottom-1 left-0 right-0 h-px bg-seal" />
                    )}
                    {i < FILTER_OPTIONS.length - 1 && (
                      <span className="hidden sm:inline-block ml-5 text-brass/30">·</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brass/60" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('gallery.search')}
                  className="pl-8 h-9 bg-ink/60 border border-brass/35 hover:border-brass/60 focus:border-brass text-ivory placeholder:text-brass/40 rounded-none font-prose text-[13px] italic"
                />
              </div>
              {/* 2D / 3D toggle */}
              <button
                onClick={() => setView3D(v => !v)}
                title={view3D ? 'Текст харагдац' : '3D харагдац'}
                className="relative group flex items-center gap-1.5 px-3 h-9 font-meta text-[10px] tracking-[0.24em] uppercase text-brass hover:text-ivory transition-colors border border-brass/40 hover:border-brass"
              >
                {view3D ? <LayoutGrid className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                {view3D ? 'II·D' : 'III·D'}
              </button>
            </div>
          </div>

          {/* Era filter row — second dimension */}
          <div className="mt-4 pt-3 border-t border-brass/20 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-meta text-[9px] tracking-[0.3em] uppercase text-brass/60 mr-1">Era ·</span>
            {[{ key: 'all', label: 'Бүгд', label_en: 'All', roman: '∑' },
              ...ERA_KEYS.map((k) => ({ key: k, label: ERAS[k].label, label_en: ERAS[k].label_en, roman: ERAS[k].roman }))
            ].map((opt, i, arr) => {
              const active = eraFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setEraFilter(opt.key)}
                  className="group flex items-baseline gap-1.5 py-1 relative"
                  title={opt.label}
                >
                  <span
                    className={`font-meta text-[9px] tracking-[0.3em] transition-colors ${
                      active ? 'text-seal' : 'text-brass/55 group-hover:text-brass'
                    }`}
                  >
                    {opt.roman}.
                  </span>
                  <span
                    className={`font-display text-[12px] md:text-sm transition-colors ${
                      active ? 'text-ivory' : 'text-ivory/55 group-hover:text-ivory'
                    }`}
                    style={{ fontVariationSettings: '"opsz" 24, "SOFT" 40' }}
                  >
                    {(() => {
                      const label = lang === 'en' ? (opt.label_en || opt.label) : opt.label;
                      return label.length > 14 ? label.split(' ')[0] : label;
                    })()}
                  </span>
                  {active && (
                    <span className="absolute -bottom-1 left-0 right-0 h-px bg-seal" />
                  )}
                  {i < arr.length - 1 && (
                    <span className="hidden sm:inline-block ml-4 text-brass/25">·</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* result count — minimal, left-aligned */}
          <p className="font-meta text-[10px] tracking-[0.22em] uppercase text-brass/65 mt-3">
            <span className="text-ivory">{String(filtered.length).padStart(2, '0')}</span> / {figures.length} {t('gallery.resultFound')}
            {filter !== 'all' && (
              <span className="ml-2 text-brass">· {t('gallery.filterBy.cat')}: {FILTER_OPTIONS.find(o => o.key === filter)?.[lang === 'en' ? 'label_en' : 'label']}</span>
            )}
            {eraFilter !== 'all' && (
              <span className="ml-2 text-brass">· {t('gallery.filterBy.era')}: {ERAS[eraFilter]?.roman}</span>
            )}
            {debouncedSearch && <span className="ml-2 text-seal">· {t('gallery.filterBy.q')}: "{debouncedSearch}"</span>}
          </p>
        </div>

        {/* Groups */}
        {Object.entries(grouped).map(([cat, figs]) => {
          const c = CATEGORIES[cat];
          return (
            <div key={cat} className="mb-16">
              {/* Group header — codex-style */}
              <div className="flex items-end gap-4 mb-7">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 flex items-center justify-center border border-brass/50"
                    style={{ background: `${c?.color}22` }}
                  >
                    <CategoryGlyph cat={cat} size={22} className="text-brass" />
                  </span>
                  <div>
                    <span className="font-meta text-[9.5px] tracking-[0.3em] uppercase text-brass/80">
                      {c?.roman} · {c?.genus}
                    </span>
                    <h3
                      className="font-display text-2xl text-ivory leading-none"
                      style={{ fontVariationSettings: '"opsz" 36, "SOFT" 50' }}
                    >
                      {lang === 'en' ? (c?.label_en || c?.label) : c?.label}
                    </h3>
                  </div>
                </div>
                <div className="flex-1 h-px bg-brass/30 mb-2" />
                <span className="font-meta text-[10px] tracking-[0.26em] text-brass/75 mb-1">
                  {String(figs.length).padStart(2, '0')} entries
                </span>
              </div>

              <div className={view3D
                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'
              }>
                {figs.map((fig, i) => (
                  <div
                    key={fig.fig_id}
                    className="reveal"
                    style={{ transitionDelay: `${Math.min(i * 45, 600)}ms` }}
                  >
                    {view3D
                      ? <Card3D figure={fig} onClick={onCardClick} />
                      : <FigureCard
                          figure={fig}
                          isInTeam={isInTeam?.(fig.fig_id)}
                          onToggleTeam={onToggleTeam}
                          isInCompare={isInCompare?.(fig.fig_id)}
                          onToggleCompare={onToggleCompare}
                        />
                    }
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <Fleuron size={48} className="mx-auto opacity-60" />
            <p className="font-display text-lg text-ivory/75">Үр дүн олдсонгүй</p>
            <p className="font-prose text-sm italic text-ivory/50">Хайлтын үгээ дахин оролдоорой</p>
          </div>
        )}
      </div>
    </section>
  );
}

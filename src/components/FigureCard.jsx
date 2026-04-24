import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@/lib/figuresData';
import { useLang, figureName, figureRole } from '@/lib/i18n';
import CornerTicks from '@/components/ornaments/CornerTicks';
import SealMark from '@/components/ornaments/SealMark';
import CategoryGlyph from '@/components/ornaments/CategoryGlyph';

export default function FigureCard({ figure, isInTeam, onToggleTeam, isInCompare, onToggleCompare }) {
  const cardRef = useRef(null);
  const navigate = useNavigate();
  const cat = CATEGORIES[figure.cat];
  const { lang } = useLang();

  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const rotateY = (mx - 0.5) * 12;   // subtler tilt
    const rotateX = (0.5 - my) * 9;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    card.style.setProperty('--mx', mx);
    card.style.setProperty('--my', my);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
  }, []);

  const pad = String(figure.fig_id).padStart(2, '0');

  return (
    <div
      ref={cardRef}
      className="figure-card group relative bg-card cursor-pointer overflow-hidden select-none"
      style={{
        transition: 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        aspectRatio: '3 / 4.4',
        boxShadow: '0 2px 0 hsl(var(--brass) / 0.2), 0 12px 36px -12px rgba(0,0,0,0.7)',
      }}
      onClick={() => navigate(`/figure/${figure.fig_id}`)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* hairline border + subtle brass inner border */}
      <span aria-hidden className="pointer-events-none absolute inset-0 border border-brass/30 group-hover:border-brass/70 transition-colors" />
      <span aria-hidden className="pointer-events-none absolute inset-1.5 border border-brass/15" />
      <CornerTicks size={10} inset={6} thickness={1} opacity={0.85} />

      {/* Portrait plate — dramatic sepia vignette */}
      <div
        className="relative h-[60%] overflow-hidden"
        style={{
          background: `linear-gradient(152deg, ${cat?.color || '#333'} 0%, #1a140c 85%)`,
        }}
      >
        {figure.front_img ? (
          <>
            <img
              src={figure.front_img}
              alt={figure.name}
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-95 group-hover:opacity-100 transition-opacity"
            />
            {/* warm duotone overlay */}
            <span
              aria-hidden
              className="absolute inset-0 mix-blend-multiply opacity-75"
              style={{ background: `linear-gradient(152deg, ${cat?.color || '#333'}dd 0%, #0e0b07 95%)` }}
            />
            {/* top→bottom ink vignette */}
            <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/85" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <CategoryGlyph cat={figure.cat} size={64} className="text-ivory/40" />
          </div>
        )}

        {/* catalog no — upper-left, mono */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
          <span className="font-meta text-[10px] tracking-[0.28em] text-ivory/85 bg-ink/55 backdrop-blur-sm px-1.5 py-0.5 border border-brass/40">
            N° {pad}
          </span>
        </div>

        {/* category glyph — upper-right */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
          <span
            className="w-7 h-7 flex items-center justify-center text-ivory bg-ink/60 border border-brass/40"
            title={cat?.label}
          >
            <CategoryGlyph cat={figure.cat} size={18} className="text-brass" />
          </span>
        </div>

        {/* bottom card rank meta (e.g. "Хааны Туз") */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 z-10">
          <span className="font-meta text-[9px] tracking-[0.3em] uppercase text-brass/90 block">
            {cat?.genus} · {cat?.roman}
          </span>
        </div>
      </div>

      {/* Card info plate */}
      <div className="relative h-[40%] flex flex-col justify-between px-3 py-3">
        <div>
          <h3
            className="font-display text-[15px] leading-[1.08] text-ivory"
            style={{ fontVariationSettings: '"opsz" 36, "SOFT" 50, "wght" 550' }}
          >
            {figureName(figure, lang)}
          </h3>
          <p className="font-meta text-[9.5px] tracking-[0.14em] text-brass/80 mt-1">
            {figure.yrs}
          </p>
          <p className="font-prose italic text-[11px] text-ivory/60 mt-1.5 line-clamp-2 leading-snug">
            {figureRole(figure, lang)}
          </p>
        </div>

        {/* bottom action row */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-brass/20">
          <span className="font-meta text-[8.5px] tracking-[0.22em] uppercase text-ivory/45">
            {figure.card}
          </span>
          <div className="flex items-center gap-1.5">
            {onToggleTeam && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleTeam(figure.fig_id); }}
                title="Багт нэмэх"
                aria-pressed={isInTeam}
                className="relative w-7 h-7 flex items-center justify-center transition-transform hover:scale-110"
              >
                <SealMark
                  size={20}
                  variant={isInTeam ? 'filled' : 'outline'}
                  pulse={isInTeam}
                />
              </button>
            )}
            {onToggleCompare && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCompare(figure.fig_id); }}
                title="Харьцуулахад нэмэх"
                aria-pressed={isInCompare}
                className={`w-7 h-7 flex items-center justify-center border transition-all ${
                  isInCompare
                    ? 'bg-brass text-ink border-brass'
                    : 'text-brass/80 border-brass/40 hover:border-brass hover:text-brass'
                }`}
              >
                {/* compare glyph: two overlapping rectangles */}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <rect x="1" y="1.5" width="6" height="8" />
                  <rect x="5" y="2.5" width="6" height="8" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* category accent stripe at the very bottom */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${cat?.color}, transparent 75%)`,
        }}
      />
    </div>
  );
}

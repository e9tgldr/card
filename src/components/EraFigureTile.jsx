import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@/lib/figuresData';
import { useLang, figureName } from '@/lib/i18n';
import CategoryGlyph from '@/components/ornaments/CategoryGlyph';

/**
 * EraFigureTile — compact figure tile used inside an era chapter strip.
 * Shows catalog number + portrait + name.  ~3/4 aspect ratio, ~90×120px.
 */
function EraFigureTile({ figure }) {
  const navigate = useNavigate();
  const cat = CATEGORIES[figure.cat];
  const pad = String(figure.fig_id).padStart(2, '0');
  const { lang } = useLang();
  const name = figureName(figure, lang);

  return (
    <button
      onClick={() => navigate(`/figure/${figure.fig_id}`)}
      className="group relative flex-shrink-0 w-[92px] md:w-[104px] overflow-hidden border border-brass/30 hover:border-brass transition-colors bg-card text-left"
      style={{ aspectRatio: '3 / 4' }}
      title={`${name} · ${figure.yrs}`}
    >
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(158deg, ${cat?.color}, #0e0b07 95%)` }}
      />
      {figure.front_img ? (
        <>
          <img
            src={figure.front_img}
            alt={name}
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <span
            aria-hidden
            className="absolute inset-0 mix-blend-multiply opacity-65"
            style={{ background: `linear-gradient(158deg, ${cat?.color}dd, #0e0b07 95%)` }}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <CategoryGlyph cat={figure.cat} size={32} className="text-ivory/40" />
        </div>
      )}
      {/* bottom ink fade */}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />

      {/* catalog number */}
      <span className="absolute top-1.5 left-1.5 font-meta text-[8px] tracking-[0.22em] text-ivory/90 bg-ink/55 px-1 py-0.5 border border-brass/40">
        N° {pad}
      </span>

      {/* name at bottom */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10">
        <p
          className="font-display text-[11px] leading-[1.05] text-ivory line-clamp-2"
          style={{ fontVariationSettings: '"opsz" 24, "SOFT" 40' }}
        >
          {name}
        </p>
      </div>
      {/* category stripe */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: cat?.color }}
      />
    </button>
  );
}

export default memo(EraFigureTile);

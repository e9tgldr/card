import { memo } from 'react';

/**
 * SealMark — an imperial red wax-seal mark.
 * Used for "in team", "collected", or decorative section flourishes.
 * - variant="filled"  → solid seal with inner knot and rim (for "collected")
 * - variant="outline" → hollow rim only (for "not yet collected")
 */
function SealMark({ size = 28, variant = 'filled', pulse = false, className = '', title }) {
  const filled = variant === 'filled';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      className={`${pulse ? 'seal-pulse' : ''} ${className}`}
    >
      {/* outer ragged wax rim */}
      <path
        d="M30 2 Q42 4 48 12 Q56 18 58 30 Q56 42 48 48 Q42 56 30 58 Q18 56 12 48 Q4 42 2 30 Q4 18 12 12 Q18 4 30 2 Z"
        fill={filled ? 'hsl(var(--seal))' : 'transparent'}
        stroke="hsl(var(--seal))"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* inner rim */}
      <circle
        cx="30" cy="30" r="21"
        fill="none"
        stroke={filled ? 'hsl(var(--ivory) / 0.35)' : 'hsl(var(--seal) / 0.55)'}
        strokeWidth="0.8"
      />
      {/* knotwork glyph — four-petal Soyombo-inspired */}
      <g stroke={filled ? 'hsl(var(--ivory) / 0.9)' : 'hsl(var(--seal))'} strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M30 16 L30 44" />
        <path d="M16 30 L44 30" />
        <circle cx="30" cy="30" r="6" />
        <path d="M22 22 L38 38 M38 22 L22 38" opacity="0.55" />
      </g>
    </svg>
  );
}

export default memo(SealMark);

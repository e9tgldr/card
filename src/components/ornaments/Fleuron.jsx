import { memo } from 'react';

/**
 * Fleuron — a Soyombo-inspired ornament used between sections or at hero corners.
 * Reduces to a tiny diamond glyph at small sizes.
 */
function Fleuron({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} role="presentation">
      <g fill="none" stroke="hsl(var(--brass))" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        {/* central flame (Soyombo top element) */}
        <path d="M40 10 L34 24 L40 20 L46 24 Z" fill="hsl(var(--brass) / 0.35)" />
        {/* sun / moon circle */}
        <circle cx="40" cy="30" r="3.5" fill="hsl(var(--seal))" stroke="hsl(var(--seal))" />
        {/* upper arrow */}
        <path d="M40 38 L40 55" />
        <path d="M40 38 L36 44 M40 38 L44 44" />
        {/* horizontal bars */}
        <path d="M24 44 L56 44" opacity="0.9" />
        <path d="M28 48 L52 48" opacity="0.6" />
        {/* two fish (Yin-Yang) eyes */}
        <circle cx="34" cy="62" r="2" />
        <circle cx="46" cy="62" r="2" />
        {/* base */}
        <path d="M22 70 L58 70" />
        <path d="M26 73 L54 73" opacity="0.55" />
      </g>
    </svg>
  );
}

export default memo(Fleuron);

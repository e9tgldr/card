import { memo } from 'react';

/**
 * CategoryGlyph — custom SVG icon for each figure category (replaces emoji).
 *  khans     → crown + zigzag
 *  queens    → lotus / veil
 *  warriors  → crossed bow-and-arrow
 *  political → scroll + seal
 *  cultural  → pipa / morin-khuur silhouette
 */
const GLYPHS = {
  khans: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16 L8 8 L12 14 L16 6 L20 14 L24 8 L28 16 Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M4 20 L28 20" />
      <path d="M8 20 L8 24 M16 20 L16 24 M24 20 L24 24" />
      <circle cx="16" cy="11" r="1.4" fill="hsl(var(--seal))" stroke="hsl(var(--seal))" />
    </g>
  ),
  queens: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4 C 10 10 10 16 16 18 C 22 16 22 10 16 4 Z" fill="currentColor" fillOpacity="0.1" />
      <path d="M16 18 L16 26" />
      <path d="M10 22 Q16 28 22 22" />
      <circle cx="16" cy="11" r="1.4" fill="hsl(var(--seal))" stroke="hsl(var(--seal))" />
      <path d="M6 26 L26 26" />
    </g>
  ),
  warriors: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6 Q16 16 4 26" />
      <path d="M4 6 L6 10 M4 26 L6 22" />
      <path d="M6 16 L26 16" />
      <path d="M22 12 L26 16 L22 20" />
      <path d="M16 10 L16 22" opacity="0.45" />
    </g>
  ),
  political: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="6" width="18" height="22" fill="currentColor" fillOpacity="0.08" />
      <path d="M23 6 Q27 6 27 10 Q27 14 23 14 L5 14" />
      <path d="M9 18 L19 18 M9 22 L17 22" opacity="0.8" />
      <circle cx="22" cy="24" r="3" fill="hsl(var(--seal))" stroke="hsl(var(--seal))" />
    </g>
  ),
  cultural: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 L14 8 L10 8 L12 4 Z" fill="currentColor" />
      <path d="M12 8 L12 18" />
      <ellipse cx="14" cy="22" rx="8" ry="6" fill="currentColor" fillOpacity="0.1" />
      <path d="M10 21 L20 21" opacity="0.6" />
      <path d="M10 24 L20 24" opacity="0.6" />
      <circle cx="14" cy="22" r="1.2" fill="hsl(var(--seal))" stroke="hsl(var(--seal))" />
    </g>
  ),
};

function CategoryGlyph({ cat, size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="presentation"
    >
      {GLYPHS[cat] || GLYPHS.khans}
    </svg>
  );
}

export default memo(CategoryGlyph);

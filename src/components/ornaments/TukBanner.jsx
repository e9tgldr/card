import { memo } from 'react';

/**
 * TukBanner — silhouette of a nine-tailed tug (yak-tail banner of the khans).
 * Used as an emblematic mark in heroes and empty states.
 */
function TukBanner({ size = 56, className = '' }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" className={className} role="presentation">
      <g fill="none" stroke="hsl(var(--brass))" strokeLinecap="round" strokeLinejoin="round">
        {/* pole */}
        <line x1="30" y1="2" x2="30" y2="94" strokeWidth="1.3" />
        {/* trident head (sulde) */}
        <path d="M30 2 L30 16" strokeWidth="1.6" />
        <path d="M24 10 L30 2 L36 10" strokeWidth="1.3" />
        <path d="M22 18 L30 6 L38 18" strokeWidth="0.8" opacity="0.6" />
        {/* disc */}
        <circle cx="30" cy="28" r="6" strokeWidth="1.2" />
        <circle cx="30" cy="28" r="2.2" fill="hsl(var(--seal))" stroke="hsl(var(--seal))" />
        {/* horsehair tails */}
        {[38, 44, 50, 56, 62, 68, 74, 80, 86].map((y, i) => (
          <g key={i} strokeWidth="0.7" opacity={0.65 + (i * 0.03)}>
            <path d={`M30 ${y} Q${22 - i * 0.3} ${y + 6} ${18 - i * 0.5} ${y + 14}`} />
            <path d={`M30 ${y} Q${38 + i * 0.3} ${y + 6} ${42 + i * 0.5} ${y + 14}`} />
            <path d={`M30 ${y} Q${28 + (i % 2 ? 1 : -1)} ${y + 8} ${30 + (i % 2 ? 3 : -3)} ${y + 16}`} />
          </g>
        ))}
      </g>
    </svg>
  );
}

export default memo(TukBanner);

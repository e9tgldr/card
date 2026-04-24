import { memo } from 'react';

/**
 * ContourBackground — engraved topographic contour lines.
 * Drop it inside a relative container to give it an old-map ambient layer.
 *
 * Props:
 *   density — 'low' | 'med' | 'high'   (# of lines)
 *   tint    — css color for the strokes
 *   opacity — base opacity of the layer
 */
function ContourBackground({
  density = 'med',
  tint = 'hsl(var(--brass))',
  opacity = 0.12,
  className = '',
}) {
  const lineCount = density === 'low' ? 6 : density === 'high' ? 22 : 14;
  const lines = Array.from({ length: lineCount }, (_, i) => i);
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity }}
      role="presentation"
    >
      <defs>
        <radialGradient id="contour-fade" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="contour-mask">
          <rect width="1200" height="800" fill="url(#contour-fade)" />
        </mask>
      </defs>
      <g
        fill="none"
        stroke={tint}
        strokeLinecap="round"
        strokeLinejoin="round"
        mask="url(#contour-mask)"
      >
        {lines.map((i) => {
          const offset = i * 26 - 120;
          const amp = 52 + (i % 4) * 18;
          const freq = 280 + (i % 3) * 60;
          const d = `M-50 ${500 + offset}
                     C ${200} ${500 + offset - amp}, ${400} ${500 + offset + amp * 0.6}, ${freq + 300} ${500 + offset - amp * 0.4}
                     S ${900} ${500 + offset + amp * 0.8}, ${1250} ${500 + offset - amp * 0.2}`;
          return <path key={i} d={d} strokeWidth={0.6 + (i % 3) * 0.15} opacity={0.8 - (i % 5) * 0.08} />;
        })}
        {/* A few perpendicular ridge lines for richness */}
        {[0, 1, 2].map((i) => (
          <path
            key={`r${i}`}
            d={`M ${280 + i * 260} 0 Q ${260 + i * 260} 400 ${300 + i * 260} 800`}
            strokeWidth="0.5"
            opacity="0.35"
          />
        ))}
      </g>
    </svg>
  );
}

export default memo(ContourBackground);

export default function BrassRule({ from, to, strokeWidth = 0.5 }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.abs(x2 - x1) || 1;
  const h = Math.abs(y2 - y1) || 1;
  return (
    <svg
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{ left: minX, top: minY, width: w, height: h, overflow: 'visible' }}
      width={w}
      height={h}
    >
      <line
        x1={x1 - minX}
        y1={y1 - minY}
        x2={x2 - minX}
        y2={y2 - minY}
        stroke="hsl(var(--brass))"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

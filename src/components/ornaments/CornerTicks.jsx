import { memo } from 'react';

/**
 * CornerTicks — brass slide-mount corner markers overlaid on a card/container.
 * Expects a relatively positioned parent.  inset / size / color are tweakable.
 */
function CornerTicks({
  size = 12,
  inset = 6,
  color = 'hsl(var(--brass))',
  opacity = 0.85,
  thickness = 1,
  className = '',
}) {
  const common = {
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    borderColor: color,
    borderStyle: 'solid',
    opacity,
    pointerEvents: 'none',
  };
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      <span style={{ ...common, top: inset, left: inset,  borderWidth: `${thickness}px 0 0 ${thickness}px` }} />
      <span style={{ ...common, top: inset, right: inset, borderWidth: `${thickness}px ${thickness}px 0 0` }} />
      <span style={{ ...common, bottom: inset, left: inset,  borderWidth: `0 0 ${thickness}px ${thickness}px` }} />
      <span style={{ ...common, bottom: inset, right: inset, borderWidth: `0 ${thickness}px ${thickness}px 0` }} />
    </div>
  );
}

export default memo(CornerTicks);

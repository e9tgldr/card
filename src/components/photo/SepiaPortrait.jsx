import React, { useEffect, useRef } from 'react';

const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function SepiaPortrait({
  figure,
  aspectRatio = '3/4',
  caption,
  size,
  fit = 'cover',
  position = 'center top',
  tilt = false,
}) {
  const hasPortrait = !!figure?.portrait_url;
  const fillParent = aspectRatio === 'auto';
  const tiltLayerRef = useRef(null);

  useEffect(() => {
    if (!tilt) return undefined;
    const el = tiltLayerRef.current;
    if (!el) return undefined;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches;
    if (reduced) return undefined;

    let raf = null;
    const target = { rx: 0, ry: 0, tx: 0, ty: 0 };
    const current = { rx: 0, ry: 0, tx: 0, ty: 0 };
    const MAX_ROT = 3;
    const MAX_TRANS = 12;
    const EASE = 0.08;

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      target.ry = Math.max(-1, Math.min(1, dx)) * MAX_ROT;
      target.rx = -Math.max(-1, Math.min(1, dy)) * MAX_ROT;
      target.tx = -dx * MAX_TRANS;
      target.ty = -dy * MAX_TRANS;
      schedule();
    }
    function onLeave() {
      target.rx = 0;
      target.ry = 0;
      target.tx = 0;
      target.ty = 0;
      schedule();
    }
    function tick() {
      raf = null;
      current.rx += (target.rx - current.rx) * EASE;
      current.ry += (target.ry - current.ry) * EASE;
      current.tx += (target.tx - current.tx) * EASE;
      current.ty += (target.ty - current.ty) * EASE;
      el.style.transform = `perspective(1400px) rotateX(${current.rx.toFixed(2)}deg) rotateY(${current.ry.toFixed(2)}deg) translate3d(${current.tx.toFixed(2)}px, ${current.ty.toFixed(2)}px, 0) scale(1.06)`;
      const settled =
        Math.abs(target.rx - current.rx) < 0.01 &&
        Math.abs(target.ry - current.ry) < 0.01 &&
        Math.abs(target.tx - current.tx) < 0.05 &&
        Math.abs(target.ty - current.ty) < 0.05;
      if (!settled) schedule();
    }
    function schedule() {
      if (raf == null) raf = requestAnimationFrame(tick);
    }

    el.style.transformOrigin = '50% 50%';
    el.style.willChange = 'transform';
    el.style.transform = 'perspective(1400px) scale(1.06)';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      if (raf != null) cancelAnimationFrame(raf);
      el.style.willChange = 'auto';
    };
  }, [tilt]);

  const wrapperStyle = {
    position: 'relative',
    width: size ?? '100%',
    height: fillParent ? '100%' : undefined,
    aspectRatio: fillParent ? undefined : aspectRatio,
    overflow: 'hidden',
    background: fillParent
      ? 'transparent'
      : 'linear-gradient(135deg, #d4a87a 0%, #5a3a1c 60%, #1a1006 100%)',
    perspective: tilt ? '1400px' : undefined,
  };

  const tiltLayerStyle = tilt
    ? {
        position: 'absolute',
        inset: 0,
        transform: 'perspective(1400px) scale(1.06)',
        transformOrigin: '50% 50%',
      }
    : { position: 'absolute', inset: 0 };

  return (
    <div data-photo="sepia-wrap" style={wrapperStyle}>
      <div ref={tiltLayerRef} style={tiltLayerStyle}>
        {hasPortrait ? (
          <img
            data-photo="sepia"
            src={figure.portrait_url}
            alt={figure.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: fit,
              objectPosition: position,
              filter: 'sepia(0.3) contrast(1.05) saturate(0.9)',
              boxShadow: tilt ? '0 40px 80px rgba(0,0,0,0.55)' : undefined,
            }}
          />
        ) : (
          <div
            data-photo="sepia-fallback"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0 }}
          />
        )}
      </div>
      <div
        data-photo="sepia-overlay"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(180,150,110,0) 0%, rgba(80,50,30,0.25) 65%, rgba(20,12,6,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        data-photo="sepia-overlay"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: GRAIN_SVG,
          backgroundSize: '160px 160px',
          mixBlendMode: 'overlay',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />
      <div
        data-photo="sepia-overlay"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 200px 50px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}
      />
      {caption ? (
        <div
          data-photo="sepia-caption"
          style={{
            position: 'absolute',
            left: 14,
            bottom: 14,
            fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
            fontSize: 10,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: '#FFCC00',
            zIndex: 2,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}

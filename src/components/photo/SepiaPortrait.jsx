import React from 'react';

const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

export function SepiaPortrait({
  figure,
  aspectRatio = '3/4',
  caption,
  size,
}) {
  const hasPortrait = !!figure?.portrait_url;
  const fillParent = aspectRatio === 'auto';
  const wrapperStyle = {
    position: 'relative',
    width: size ?? '100%',
    height: fillParent ? '100%' : undefined,
    aspectRatio: fillParent ? undefined : aspectRatio,
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #d4a87a 0%, #5a3a1c 60%, #1a1006 100%)',
  };
  return (
    <div data-photo="sepia-wrap" style={wrapperStyle}>
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
            objectFit: fillParent ? 'contain' : 'cover',
            objectPosition: fillParent ? 'right bottom' : 'center top',
            filter: 'sepia(0.3) contrast(1.05) saturate(0.9)',
          }}
        />
      ) : (
        <div
          data-photo="sepia-fallback"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0 }}
        />
      )}
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

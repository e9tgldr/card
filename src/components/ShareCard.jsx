import { useEffect, useRef, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Copy, Check, Loader2 } from 'lucide-react';
import { CATEGORIES } from '@/lib/figuresData';
import { useLang, figureName, figureRole } from '@/lib/i18n';
import CornerTicks from '@/components/ornaments/CornerTicks';
import CategoryGlyph from '@/components/ornaments/CategoryGlyph';
import Fleuron from '@/components/ornaments/Fleuron';
import BrassButton from '@/components/ornaments/BrassButton';

/**
 * ShareCard — modal that previews a printable/share-ready card for a figure
 * and lets the user download a PNG, copy a deep link, or invoke the native
 * Web Share sheet.
 *
 * Internal: an off-screen DOM "snapshotTarget" mirrors the visual card with
 * fixed pixel dimensions for reliable html2canvas output.
 */
export default function ShareCard({ figure, onClose }) {
  const { lang } = useLang();
  const cat = CATEGORIES[figure?.cat];
  const snapshotRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const pad = String(figure?.fig_id || 0).padStart(2, '0');
  const name = figureName(figure, lang);
  const role = figureRole(figure, lang);

  const deepLink = typeof window !== 'undefined'
    ? `${window.location.origin}/figure/${figure?.fig_id}`
    : '';

  // ───── lock scroll while open ──────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ───── snapshot helpers ────────────────────────────────────────────────
  const snapshot = useCallback(async () => {
    if (!snapshotRef.current) return null;
    const canvas = await html2canvas(snapshotRef.current, {
      backgroundColor: '#0E0B07',
      scale: 2,
      useCORS: true,
      logging: false,
      removeContainer: false,
    });
    return canvas;
  }, []);

  const download = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const canvas = await snapshot();
      if (!canvas) throw new Error('snapshot failed');
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `mthk-${pad}-${(name || 'figure').replace(/\s+/g, '-')}.png`;
      a.click();
    } catch (e) {
      setError(lang === 'en' ? 'Could not export image. Try again.' : 'Зургийг үүсгэж чадсангүй.');
    } finally {
      setBusy(false);
    }
  }, [snapshot, name, pad, lang]);

  const share = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      // Fallback to download if Web Share isn't available
      return download();
    }
    setBusy(true);
    setError(null);
    try {
      const canvas = await snapshot();
      if (!canvas) throw new Error('snapshot failed');
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], `mthk-${pad}.png`, { type: 'image/png' });
      const shareData = {
        title: name,
        text: `${name} · ${figure.yrs} — ${role}`,
        files: [file],
        url: deepLink,
      };
      // Some browsers reject files; gracefully fall back.
      if (navigator.canShare && !navigator.canShare(shareData)) {
        delete shareData.files;
      }
      await navigator.share(shareData);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setError(lang === 'en' ? 'Sharing failed. Downloading instead.' : 'Хуваалцаж чадсангүй. Татаж байна.');
        download();
      }
    } finally {
      setBusy(false);
    }
  }, [snapshot, name, pad, role, figure?.yrs, deepLink, download, lang]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(lang === 'en' ? 'Could not copy link.' : 'Холбоосыг хуулж чадсангүй.');
    }
  }, [deepLink, lang]);

  if (!figure) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-ink/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative w-full max-w-md bg-ink border border-brass/40"
          onClick={(e) => e.stopPropagation()}
        >
          <CornerTicks size={14} inset={8} thickness={1} opacity={0.95} />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-brass/25">
            <div>
              <div className="font-meta text-[9.5px] tracking-[0.32em] uppercase text-brass/80">
                {lang === 'en' ? 'Share figure' : 'Хуваалцах'}
              </div>
              <div
                className="font-display text-base text-ivory mt-0.5"
                style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50' }}
              >
                {name}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-brass/70 hover:text-ivory transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Snapshot preview (visible) — also the html2canvas target */}
          <div className="p-5 flex justify-center">
            <div
              ref={snapshotRef}
              style={{
                width: 320,
                height: 480,
                background: 'hsl(var(--ink))',
                color: 'hsl(var(--ivory))',
                position: 'relative',
                fontFamily: 'var(--font-display)',
              }}
            >
              {/* Top portrait plate — uses inline styles so html2canvas captures
                  the exact pixels regardless of stylesheet load order. */}
              <div
                style={{
                  position: 'relative',
                  height: 280,
                  background: `linear-gradient(152deg, ${cat?.color || '#9A1B1B'} 0%, #1a140c 92%)`,
                  overflow: 'hidden',
                  borderBottom: `1px solid hsl(var(--brass) / 0.4)`,
                }}
              >
                {figure.front_img ? (
                  <>
                    <img
                      src={figure.front_img}
                      alt={name}
                      crossOrigin="anonymous"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        mixBlendMode: 'luminosity',
                        opacity: 0.95,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(152deg, ${cat?.color || '#9A1B1B'}dd 0%, #0e0b07 95%)`,
                        mixBlendMode: 'multiply',
                        opacity: 0.7,
                      }}
                    />
                  </>
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CategoryGlyph cat={figure.cat} size={96} className="text-ivory/40" />
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, transparent 50%, hsl(var(--ink)/0.9))',
                  }}
                />
                {/* Catalog number */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    padding: '3px 8px',
                    border: `1px solid hsl(var(--brass) / 0.6)`,
                    background: 'hsl(var(--ink) / 0.6)',
                    fontFamily: 'var(--font-meta)',
                    fontSize: 10,
                    letterSpacing: '0.28em',
                    color: 'hsl(var(--ivory) / 0.92)',
                  }}
                >
                  N° {pad}
                </div>
                {/* Genus label */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 14,
                    fontFamily: 'var(--font-meta)',
                    fontSize: 9.5,
                    letterSpacing: '0.32em',
                    textTransform: 'uppercase',
                    color: 'hsl(var(--brass))',
                  }}
                >
                  {cat?.genus} · {cat?.roman}
                </div>
              </div>

              {/* Info plate */}
              <div style={{ padding: '18px 16px 14px', position: 'relative' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    lineHeight: 1.05,
                    color: 'hsl(var(--ivory))',
                    fontVariationSettings: '"opsz" 48, "SOFT" 60, "WONK" 1, "wght" 540',
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-meta)',
                    fontSize: 10.5,
                    letterSpacing: '0.18em',
                    color: 'hsl(var(--brass))',
                    marginTop: 6,
                  }}
                >
                  {figure.yrs}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-prose)',
                    fontStyle: 'italic',
                    fontSize: 12.5,
                    color: 'hsl(var(--ivory) / 0.7)',
                    marginTop: 6,
                    lineHeight: 1.45,
                    minHeight: 36,
                  }}
                >
                  {role}
                </div>

                {/* Hairline */}
                <div
                  style={{
                    height: 1,
                    background: 'linear-gradient(to right, transparent, hsl(var(--brass) / 0.55), transparent)',
                    margin: '14px 0 12px',
                  }}
                />

                {/* Footer line */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-meta)',
                      fontSize: 9,
                      letterSpacing: '0.28em',
                      textTransform: 'uppercase',
                      color: 'hsl(var(--brass) / 0.85)',
                    }}
                  >
                    ALTAN DOMOG · COLLECTION I
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-meta)',
                      fontSize: 9,
                      letterSpacing: '0.22em',
                      color: 'hsl(var(--brass) / 0.7)',
                    }}
                  >
                    {figure.card}
                  </span>
                </div>
              </div>

              {/* Brass corner ticks */}
              {[
                { top: 6, left: 6, b: '1px 0 0 1px' },
                { top: 6, right: 6, b: '1px 1px 0 0' },
                { bottom: 6, left: 6, b: '0 0 1px 1px' },
                { bottom: 6, right: 6, b: '0 1px 1px 0' },
              ].map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 16,
                    height: 16,
                    borderColor: 'hsl(var(--brass))',
                    borderStyle: 'solid',
                    borderWidth: p.b,
                    pointerEvents: 'none',
                    ...p,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={copyLink}
                className="flex items-center gap-2 font-meta text-[10px] tracking-[0.24em] uppercase text-brass hover:text-ivory transition-colors px-3 py-2 border border-brass/40 hover:border-brass"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied
                  ? (lang === 'en' ? 'Copied' : 'Хуулагдлаа')
                  : (lang === 'en' ? 'Copy link' : 'Холбоос')}
              </button>

              <div className="flex items-center gap-2">
                <BrassButton
                  variant="ghost"
                  size="sm"
                  onClick={download}
                  disabled={busy}
                  icon={busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                >
                  {lang === 'en' ? 'Download' : 'Татах'}
                </BrassButton>
                <BrassButton
                  variant="primary"
                  size="sm"
                  onClick={share}
                  disabled={busy}
                  icon={<Share2 className="w-3 h-3" />}
                >
                  {lang === 'en' ? 'Share' : 'Хуваалцах'}
                </BrassButton>
              </div>
            </div>
            {error && (
              <p className="font-meta text-[10px] tracking-[0.18em] text-seal/90">{error}</p>
            )}
            <p className="font-meta text-[9.5px] tracking-[0.22em] uppercase text-brass/55">
              {lang === 'en' ? '320 × 480 px · PNG' : '320 × 480 пиксел · PNG'}
            </p>
          </div>

          {/* Decorative fleuron */}
          <div className="absolute -top-3 -right-3 opacity-50 pointer-events-none">
            <Fleuron size={24} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

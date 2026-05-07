import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Headphones, StopCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang, figureBio, figureName as figureNameI18n } from '@/lib/i18n';
import { useNarration } from '@/hooks/useNarration';
import { FIGURES } from '@/lib/figuresData';

const FRAMING_HINT_MS = 15000;

// MindAR is loaded via the programmatic three.js API rather than the A-Frame
// component build because mind-ar's `mindar-image-aframe.prod.js` was authored
// for `<script src=...>` tag loading and accesses `AFRAME` as a bare global at
// module-eval time. Under Vite's production bundling that registration can
// run before A-Frame attaches itself to `window.AFRAME`, leaving the scene
// without a `mindar-image-system` and trapping the user on an "AR error"
// panel forever. The three.js path (`mindar-image-three.prod.js`) ships a
// real ESM named export, depends only on `three` (a peerDep we already have),
// and gives us direct control of the camera-video lifecycle so we can call
// `start()` synchronously inside a fresh user gesture — which iOS Safari
// requires for inline `<video>.play()` from a MediaStream.
export default function MultiTargetARScene({
  packUrl,
  targetOrder,
  videosByFigId = {},
  onError,
}) {
  const containerRef = useRef(null);
  const mindarRef = useRef(null);
  const overlayVideosRef = useRef([]);
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [activeIndex, setActiveIndex] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  const activeFigId = activeIndex == null ? null : (targetOrder?.[activeIndex] ?? null);
  const activeFigure = activeFigId
    ? FIGURES.find((f) => f.fig_id === activeFigId) ?? null
    : null;
  const voiceText = activeFigure ? figureBio(activeFigure, lang) : '';
  const narration = useNarration({ text: voiceText, lang, useSpeak: true });

  const handleStart = async () => {
    const mindar = mindarRef.current;
    if (!mindar) {
      onError?.(new Error('MindARThree not initialised'));
      return;
    }
    try {
      // start() runs the whole pipeline: getUserMedia, camera-video setup,
      // pack download (already pre-warmed in MultiTargetARView), tracker
      // dummy run. Because this call originates synchronously inside the
      // click handler, iOS Safari treats the camera <video>.play() inside
      // start() as gesture-bound and lets it through. MindARThree handles
      // playsinline + muted on the camera video itself, so we don't need
      // to reach into its internals here.
      await mindar.start();

      // Begin the render loop. Without setAnimationLoop the WebGL canvas
      // stays blank even though MindARThree is tracking.
      mindar.renderer.setAnimationLoop(() => {
        mindar.renderer.render(mindar.scene, mindar.camera);
      });

      setStarted(true);
    } catch (err) {
      onError?.(err);
    }
  };

  useEffect(() => {
    if (!packUrl || !targetOrder?.length || !containerRef.current) return;
    let cancelled = false;
    let mindar = null;
    let hintTimer;

    (async () => {
      try {
        const [{ MindARThree }, threeMod] = await Promise.all([
          import('mind-ar/dist/mindar-image-three.prod.js'),
          import('three'),
        ]);
        if (cancelled || !containerRef.current) return;

        const THREE = threeMod;
        mindar = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: packUrl,
          // The UI shows one active figure at a time — we never need to
          // track more than one card simultaneously. The previous setting
          // of `targetOrder.length` told MindAR to track up to 52 cards
          // in parallel, which makes the controller's dummy-run pass
          // significantly heavier (and on weaker iOS devices, can stall
          // start() outright). All targets remain registered; only the
          // simultaneous-active count is capped.
          maxTrack: 1,
          uiLoading: 'no',
          uiError: 'no',
          uiScanning: 'no',
        });
        mindarRef.current = mindar;

        const overlayVideos = new Array(targetOrder.length).fill(null);

        for (let idx = 0; idx < targetOrder.length; idx++) {
          const figId = targetOrder[idx];
          const meta = videosByFigId[figId];

          const anchor = mindar.addAnchor(idx);
          anchor.onTargetFound = () => {
            if (cancelled) return;
            setActiveIndex(idx);
            setShowHint(false);
            clearTimeout(hintTimer);
            const v = overlayVideos[idx];
            v?.play?.().catch(() => { /* iOS may need a user gesture, ignore */ });
          };
          anchor.onTargetLost = () => {
            if (cancelled) return;
            setActiveIndex((curr) => (curr === idx ? null : curr));
            const v = overlayVideos[idx];
            v?.pause?.();
          };

          if (meta?.url) {
            // Per-target video overlay. MindARThree already renders the
            // camera video as the canvas background, so this video just
            // becomes a textured plane attached to the tracked card.
            const video = document.createElement('video');
            video.src = meta.url;
            video.preload = 'auto';
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('loop', '');
            overlayVideos[idx] = video;

            const texture = new THREE.VideoTexture(video);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            const mesh = new THREE.Mesh(
              new THREE.PlaneGeometry(1, 0.552),
              new THREE.MeshBasicMaterial({ map: texture, transparent: false }),
            );
            anchor.group.add(mesh);
          }
          // glTF models (meta.modelUrl) were supported by the old A-Frame
          // path. Skipping for the three.js migration — none of our 52
          // figures currently ship a modelUrl per the data audit, and
          // GLTFLoader pulls in 100kB+ of three/examples. Re-add via a
          // dynamic import if/when a figure actually uses one.
        }
        overlayVideosRef.current = overlayVideos;

        if (!cancelled) {
          setReady(true);
          hintTimer = setTimeout(() => setShowHint(true), FRAMING_HINT_MS);
        }
      } catch (err) {
        if (!cancelled) onError?.(err);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      const m = mindarRef.current;
      if (m) {
        try { m.renderer?.setAnimationLoop?.(null); } catch { /* best-effort */ }
        try { m.stop?.(); } catch { /* best-effort */ }
        try {
          const dom = m.renderer?.domElement;
          if (dom?.parentNode) dom.parentNode.removeChild(dom);
        } catch { /* best-effort */ }
      }
      mindarRef.current = null;
      // Tear down overlay video elements so their MediaElementSource etc.
      // don't keep the codec pipeline pinned.
      for (const v of overlayVideosRef.current) {
        if (!v) continue;
        try { v.pause(); } catch { /* */ }
        try { v.removeAttribute('src'); v.load(); } catch { /* */ }
      }
      overlayVideosRef.current = [];
    };
  }, [packUrl, targetOrder, videosByFigId, onError]);

  return (
    <div className="fixed inset-0 bg-black z-[300]">
      <div ref={containerRef} className="absolute inset-0" />

      {!started && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85" data-testid="ar-start-overlay">
          {ready ? (
            <button
              type="button"
              onClick={handleStart}
              className="px-7 py-3.5 border border-gold rounded text-gold font-meta tracking-[0.24em] uppercase text-sm hover:bg-gold/10"
            >
              {t('ar.start')}
            </button>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-crimson rounded-full animate-spin mx-auto" />
              <p className="text-sm text-ivory/70 font-body">{t('ar.start.preparing')}</p>
            </div>
          )}
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-ivory flex items-center gap-1.5 text-sm font-meta tracking-[0.22em] uppercase"
          aria-label={t('ar.back')}
        >
          <ArrowLeft className="w-4 h-4" /> {t('ar.back')}
        </button>
        <div
          className="text-ivory font-cinzel text-sm truncate px-3"
          data-testid="multi-active-name"
        >
          {activeFigure ? figureNameI18n(activeFigure, lang) : t('ar.hint.framing')}
        </div>
        <div className="w-6" />
      </div>

      {showHint && activeIndex == null && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-ink/85 border border-gold/50 rounded text-xs text-gold font-body z-10 max-w-[88vw] text-center">
          {t('ar.hint.framing')}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-around px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
        <button
          type="button"
          disabled={!activeFigId}
          onClick={() => activeFigId && navigate(`/figure/${activeFigId}`)}
          className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.24em] uppercase disabled:opacity-40"
        >
          {t('ar.action.story')}
        </button>
        <button
          type="button"
          disabled={!activeFigId}
          onClick={() => activeFigId && navigate(`/figure/${activeFigId}#quiz`)}
          className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.24em] uppercase disabled:opacity-40"
        >
          {t('ar.action.quiz')}
        </button>
        <button
          type="button"
          disabled={!activeFigId}
          onClick={() => activeFigId && navigate(`/c/${activeFigId}`)}
          className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.24em] uppercase disabled:opacity-40"
        >
          {t('ar.action.askAi')}
        </button>
        <button
          type="button"
          data-testid="ar-voice-button"
          disabled={!voiceText}
          onClick={() => (narration.status === 'playing' ? narration.stop() : narration.play())}
          aria-label={narration.status === 'playing' ? t('ar.action.voiceStop') : t('ar.action.voice')}
          className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.24em] uppercase inline-flex items-center gap-2 disabled:opacity-40"
        >
          {narration.status === 'playing' ? <StopCircle className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
          {narration.status === 'playing' ? t('ar.action.voiceStop') : t('ar.action.voice')}
        </button>
      </div>
      <audio {...narration.audioProps} />
    </div>
  );
}

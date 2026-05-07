import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Headphones, StopCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang, figureBio, figureName as figureNameI18n } from '@/lib/i18n';
import { useNarration } from '@/hooks/useNarration';
import { FIGURES } from '@/lib/figuresData';

const FRAMING_HINT_MS = 15000;

export default function MultiTargetARScene({
  packUrl,
  targetOrder,
  videosByFigId = {},
  onError,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const lastDetailedErrorAtRef = useRef(0);
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [activeIndex, setActiveIndex] = useState(null);
  const [showHint, setShowHint] = useState(false);
  // Lazy-start gating. iOS Safari blocks `<video>.play()` calls that don't
  // originate inside a fresh user gesture; MindAR's autoStart fires play()
  // from inside a Promise.all().then() callback, well outside the gesture
  // window, which leaves the camera stream paused and the canvas rendering
  // a uniform color instead of the feed. Solution: disable autoStart and
  // wait for an explicit "Tap to start" click — the click handler invokes
  // `mindar-image-system.start()` directly, so play() runs synchronously
  // inside the gesture and Safari permits it.
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  const activeFigId = activeIndex == null ? null : (targetOrder?.[activeIndex] ?? null);
  const activeFigure = activeFigId
    ? FIGURES.find((f) => f.fig_id === activeFigId) ?? null
    : null;
  const voiceText = activeFigure ? figureBio(activeFigure, lang) : '';
  const narration = useNarration({ text: voiceText, lang, useSpeak: true });

  const handleStart = () => {
    const scene = sceneRef.current;
    const system = scene?.systems?.['mindar-image-system'];
    if (!system?.start) {
      onError?.(new Error('mindar-image-system not yet available'));
      return;
    }

    let originalGetUserMedia = null;
    try {
      originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      if (originalGetUserMedia) {
        try {
          navigator.mediaDevices.getUserMedia = function patchedGetUserMedia(...args) {
            const result = originalGetUserMedia.apply(this, args);
            return Promise.resolve(result).catch((err) => {
              lastDetailedErrorAtRef.current = Date.now();
              scene.emit('arError', {
                error: err,
                name: err?.name,
                message: err?.message || 'getUserMedia failed',
              });
              throw err;
            });
          };
        } catch {
          originalGetUserMedia = null;
        }
      }
      // Keep MindAR's own getUserMedia call as the first async camera action
      // after the tap. Pre-requesting permission here creates a second camera
      // acquisition on iOS and can leave MindAR's later call failing with only
      // its generic VIDEO_FAIL event.
      system.start();
      setStarted(true);
    } catch (err) {
      onError?.(err);
    } finally {
      if (originalGetUserMedia) {
        try { navigator.mediaDevices.getUserMedia = originalGetUserMedia; } catch { /* best-effort */ }
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    let scene = null;
    let stopCameraTracks = () => {};
    let hintTimer;
    let readyPollTimer = null;

    // Serialize the imports rather than Promise.all-ing them. mind-ar's
    // pre-built UMD bundle reads `window.AFRAME` at import time and calls
    // AFRAME.registerSystem('mindar-image-system', ...). If the mind-ar
    // module evaluates before A-Frame has finished attaching itself to
    // window.AFRAME (which can happen with Promise.all in a Vite production
    // build), the registration is a silent no-op and the scene never picks
    // up the system. Symptom: the user sees a 6-second wait followed by
    // "mindar-image-system did not register" because the system genuinely
    // doesn't exist on `scene.systems`. Awaiting in order, plus an explicit
    // window.AFRAME fallback before mind-ar imports, makes the registration
    // deterministic.
    (async () => {
      const aframeMod = await import('aframe');
      if (typeof window !== 'undefined' && !window.AFRAME) {
        const candidate = aframeMod?.AFRAME ?? aframeMod?.default ?? aframeMod;
        if (candidate?.registerSystem) window.AFRAME = candidate;
      }
      await import('aframe-extras').then((m) => m.loaders ?? m);
      await import('mind-ar/dist/mindar-image-aframe.prod.js');
    })().then(() => {
      if (cancelled || !containerRef.current) return;
      scene = buildScene(packUrl, targetOrder, videosByFigId);
      containerRef.current.appendChild(scene);
      sceneRef.current = scene;

      // Don't flip `ready` on appendChild — A-Frame scene init is async,
      // and `mindar-image-system` may take another 50-300ms to register
      // after appendChild returns. Showing the start button before then
      // means handleStart finds `scene.systems['mindar-image-system']`
      // undefined and surfaces "mindar-image-system not yet available"
      // (the previous bug). Poll for the registered system instead, with
      // a 6s outer cap that surfaces a clear error if it never registers.
      // The 'loaded' event provides a fast-path; polling covers iOS Safari
      // configurations where 'loaded' arrives before system registration
      // or doesn't fire reliably with autoStart=false.
      let pollAttempts = 0;
      const POLL_INTERVAL_MS = 100;
      const MAX_POLL_MS = 6000;
      const tryFlipReady = () => {
        if (cancelled) return;
        const system = scene.systems?.['mindar-image-system'];
        if (system?.start) {
          setReady(true);
          return;
        }
        pollAttempts++;
        if (pollAttempts * POLL_INTERVAL_MS < MAX_POLL_MS) {
          readyPollTimer = setTimeout(tryFlipReady, POLL_INTERVAL_MS);
        } else {
          onError?.(new Error('mindar-image-system did not register within 6s'));
        }
      };
      tryFlipReady();
      scene.addEventListener('loaded', tryFlipReady);

      const handlers = (targetOrder ?? []).map((_figId, idx) => {
        const onFound = () => {
          setActiveIndex(idx);
          setShowHint(false);
          clearTimeout(hintTimer);
          const v = scene.querySelector(`#fig-video-${idx}`);
          v?.play?.().catch(() => {});
        };
        const onLost = () => {
          setActiveIndex((curr) => (curr === idx ? null : curr));
          const v = scene.querySelector(`#fig-video-${idx}`);
          v?.pause?.();
        };
        const entity = scene.querySelector(`#mindar-target-${idx}`);
        entity?.addEventListener('targetFound', onFound);
        entity?.addEventListener('targetLost', onLost);
        return { idx, onFound, onLost, entity };
      });

      const onArError = (event) => {
        const detail = event?.detail;
        const error = detail?.error;
        if (error === 'VIDEO_FAIL' && Date.now() - lastDetailedErrorAtRef.current < 1500) {
          return;
        }
        if (error instanceof Error) {
          onError?.(error);
        } else {
          onError?.({
            name: detail?.name || 'MindARError',
            message: detail?.message || error || 'Unknown MindAR error',
            code: error,
          });
        }
      };
      scene.addEventListener('arError', onArError);

      hintTimer = setTimeout(() => setShowHint(true), FRAMING_HINT_MS);

      stopCameraTracks = () => {
        const allVideos = scene.querySelectorAll('video');
        allVideos.forEach((v) => {
          const ms = v.srcObject;
          if (ms && typeof ms.getTracks === 'function') {
            ms.getTracks().forEach((trk) => trk.stop());
          }
        });
        for (const h of handlers) {
          h.entity?.removeEventListener('targetFound', h.onFound);
          h.entity?.removeEventListener('targetLost', h.onLost);
        }
        scene.removeEventListener('loaded', tryFlipReady);
        scene.removeEventListener('arError', onArError);
      };
    }).catch((err) => {
      if (!cancelled) onError?.(err);
    });

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      if (readyPollTimer) clearTimeout(readyPollTimer);
      try { stopCameraTracks(); } catch { /* best-effort */ }
      if (scene && scene.parentNode) scene.parentNode.removeChild(scene);
      sceneRef.current = null;
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

function buildScene(packUrl, targetOrder, videosByFigId) {
  const scene = document.createElement('a-scene');
  const safePack = encodeURI(packUrl);
  // autoStart is intentionally false: see the lazy-start comment in
  // MultiTargetARScene above. start() is invoked from the user-gesture click
  // handler so iOS Safari permits the underlying video.play().
  scene.setAttribute(
    'mindar-image',
    `imageTargetSrc: ${safePack}; autoStart: false; uiLoading: no; uiError: no; uiScanning: no;`,
  );
  scene.setAttribute('color-space', 'sRGB');
  scene.setAttribute('renderer', 'colorManagement: true; physicallyCorrectLights');
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  scene.style.position = 'absolute';
  scene.style.inset = '0';

  const lightAmbient = document.createElement('a-entity');
  lightAmbient.setAttribute('light', 'type: ambient; intensity: 0.9; color: #fff');
  scene.appendChild(lightAmbient);

  const assets = document.createElement('a-assets');

  for (let idx = 0; idx < (targetOrder?.length ?? 0); idx++) {
    const figId = targetOrder[idx];
    const v = videosByFigId[figId];
    if (v?.url) {
      const video = document.createElement('video');
      video.id = `fig-video-${idx}`;
      video.src = v.url;
      video.preload = 'none';
      video.playsInline = true;
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('loop', '');
      assets.appendChild(video);
    }
  }
  scene.appendChild(assets);

  const camera = document.createElement('a-camera');
  camera.setAttribute('position', '0 0 0');
  camera.setAttribute('look-controls', 'enabled: false');
  scene.appendChild(camera);

  for (let idx = 0; idx < (targetOrder?.length ?? 0); idx++) {
    const figId = targetOrder[idx];
    const v = videosByFigId[figId];

    const target = document.createElement('a-entity');
    target.id = `mindar-target-${idx}`;
    target.setAttribute('mindar-image-target', `targetIndex: ${idx}`);

    if (v?.modelUrl) {
      const model = document.createElement('a-gltf-model');
      model.setAttribute('src', `url(${encodeURI(v.modelUrl)})`);
      model.setAttribute('position', '0 0 0.1');
      model.setAttribute('scale', '0.4 0.4 0.4');
      model.setAttribute('animation-mixer', 'clip: *; loop: repeat');
      target.appendChild(model);
    } else if (v?.url) {
      const plane = document.createElement('a-video');
      plane.setAttribute('src', `#fig-video-${idx}`);
      plane.setAttribute('width', '1');
      plane.setAttribute('height', '0.552');
      plane.setAttribute('rotation', '0 0 0');
      target.appendChild(plane);
    }

    scene.appendChild(target);
  }

  return scene;
}

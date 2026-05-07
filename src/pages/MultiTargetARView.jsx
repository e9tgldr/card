import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import { useFigureARPack } from '@/hooks/useFigureARPack';
import { useFigureBackVideos } from '@/hooks/useFigureBackVideos';
import MultiTargetARScene from '@/components/ar/MultiTargetARScene';
import BrandHeader from '@/components/ornaments/BrandHeader';

function ErrorPanel({ titleKey, bodyKey, detail, onBack, onRetry, retryLabelKey }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 bg-ink z-[300] flex items-center justify-center px-6">
      <div className="absolute top-4 left-4 md:top-6 md:left-8">
        <BrandHeader />
      </div>
      <div className="max-w-sm w-full text-center space-y-5 border border-brass/40 p-6 rounded">
        <h2 className="font-cinzel text-lg text-ivory">{t(titleKey)}</h2>
        {bodyKey && <p className="text-sm text-ivory/75 font-body">{t(bodyKey)}</p>}
        {detail && (
          <p className="text-[11px] text-ivory/45 font-body break-all px-2 leading-tight">
            {detail}
          </p>
        )}
        <div className="flex justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 border border-gold/60 text-gold text-xs font-meta tracking-[0.22em] uppercase"
            >
              {t(retryLabelKey || 'ar.error.permission.retry')}
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-brass/60 text-ivory text-xs font-meta tracking-[0.22em] uppercase"
          >
            {t('ar.back')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MultiTargetARView() {
  const navigate = useNavigate();
  const { t } = useLang();
  const pack = useFigureARPack();
  const videos = useFigureBackVideos();
  const [arError, setArError] = useState(null);
  // Raw error.message captured alongside the categorised arError so the
  // permission panel can show what actually failed underneath. Without this,
  // every iOS autoplay rejection / pack fetch failure / camera-busy / etc.
  // looks identical to a permission denial because they all bubble to
  // 'permission'. Truncated to keep the UI tidy.
  const [arErrorDetail, setArErrorDetail] = useState(null);

  // Pre-warm browser cache for the .mind file as soon as we know its URL.
  // MindAR's `start()` fetches this pack before it calls getUserMedia and
  // before the underlying video.play() — if the fetch takes 1-3s on a
  // mobile network, the wall-clock from the user's "Start camera" tap to
  // play() exceeds iOS Safari's transient user-activation window and
  // autoplay is silently rejected, putting the user back on the permission
  // panel. Hitting the URL on mount means MindAR's later fetch comes off
  // browser cache near-instantly, keeping the gesture window healthy.
  useEffect(() => {
    if (!pack.packUrl) return;
    fetch(pack.packUrl, { mode: 'cors' }).catch(() => {});
  }, [pack.packUrl]);

  // User-gesture-bound permission re-request. The previous "Try again" handler
  // only cleared `arError`, which remounted MindAR — but if the browser had
  // already cached a denial for this origin, MindAR's getUserMedia call would
  // throw again without re-prompting, putting us right back on this panel.
  // Calling getUserMedia from the click handler itself gives the browser a
  // fresh user gesture, which re-triggers the permission prompt for soft
  // denials (dismissed by tapping outside / dismissed once). For hard denials
  // (user picked "Block"), it throws synchronously and we keep the panel up.
  const requestCameraPermission = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setArError('in_app_browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.getTracks().forEach((trk) => trk.stop());
      setArError(null);
      setArErrorDetail(null);
    } catch (err) {
      const rawMsg = String(err?.name ? `${err.name}: ${err?.message ?? ''}` : err?.message ?? err ?? '');
      setArErrorDetail(rawMsg.slice(0, 240));
      const msg = rawMsg.toLowerCase();
      if (msg.includes('notfound')) setArError('no_camera');
      // Otherwise still denied — leave the permission panel visible so the
      // user can either re-tap (some browsers re-prompt after a fresh gesture
      // even after one rejection) or back out and unblock in browser settings.
    }
  };

  if (pack.loading || videos.isLoading) {
    return (
      <div
        data-testid="ar-view-loading"
        className="fixed inset-0 bg-ink flex items-center justify-center"
      >
        <div className="absolute top-4 left-4 md:top-6 md:left-8">
          <BrandHeader />
        </div>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-gold/40 mx-auto" />
          <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-crimson rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ivory/70 font-body">{t('ar.loading')}</p>
        </div>
      </div>
    );
  }

  if (!pack.ready) {
    return (
      <ErrorPanel
        titleKey="ar.pack.missing.title"
        bodyKey="ar.pack.missing.body"
        onBack={() => navigate(-1)}
      />
    );
  }

  if (arError === 'permission') {
    return (
      <ErrorPanel
        titleKey="ar.error.permission"
        detail={arErrorDetail}
        onBack={() => navigate(-1)}
        onRetry={requestCameraPermission}
        retryLabelKey="ar.error.permission.retry"
      />
    );
  }
  if (arError === 'no_camera') {
    return <ErrorPanel titleKey="ar.error.noCamera" detail={arErrorDetail} onBack={() => navigate(-1)} />;
  }
  if (arError === 'in_app_browser') {
    return <ErrorPanel titleKey="ar.error.inAppBrowser" detail={arErrorDetail} onBack={() => navigate(-1)} />;
  }

  const handleArError = (err) => {
    const rawMsg = String(err?.name ? `${err.name}: ${err?.message ?? ''}` : err?.message ?? err ?? '');
    setArErrorDetail(rawMsg.slice(0, 240));
    const msg = rawMsg.toLowerCase();
    if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      setArError('in_app_browser');
    } else if (msg.includes('notfound')) {
      setArError('no_camera');
    } else {
      setArError('permission');
    }
  };

  return (
    <MultiTargetARScene
      packUrl={pack.packUrl}
      targetOrder={pack.targetOrder}
      videosByFigId={videos.data ?? {}}
      onError={handleArError}
    />
  );
}

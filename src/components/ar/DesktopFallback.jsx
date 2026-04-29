import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { useLang } from '@/lib/i18n';
import BrandHeader from '@/components/ornaments/BrandHeader';

export default function DesktopFallback({ figId, figureName }) {
  const { t } = useLang();
  const [qrSrc, setQrSrc] = useState(null);
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/ar/${figId}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 240, margin: 1 }).then((src) => {
      if (!cancelled) setQrSrc(src);
    });
    return () => { cancelled = true; };
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-6">
      <div className="absolute top-4 left-4 md:top-6 md:left-8">
        <BrandHeader />
      </div>
      <div className="max-w-sm w-full text-center space-y-6 border border-brass/40 bg-card/40 backdrop-blur-md p-8 rounded">
        <h1 className="font-cinzel text-xl text-ivory">{figureName}</h1>
        <h2 className="font-meta text-[11px] tracking-[0.3em] uppercase text-gold">
          {t('ar.desktop.title')}
        </h2>
        <div className="flex justify-center">
          {qrSrc ? (
            <img src={qrSrc} alt="QR code" className="w-60 h-60 rounded bg-white p-2" />
          ) : (
            <div className="w-60 h-60 bg-card animate-pulse rounded" />
          )}
        </div>
        <p className="text-xs text-ivory/70 font-body">{t('ar.desktop.subtitle')}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs font-mono text-ivory/85 bg-ink/60 px-2 py-1.5 rounded border border-brass/30">
            {url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={t('ar.error.copyLink')}
            className="px-2 py-1.5 border border-brass/50 rounded hover:bg-brass/10 text-gold"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

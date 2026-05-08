import { useLang } from '@/lib/i18n';

export default function BrandHeader({ className = '', dim = false }) {
  const { lang } = useLang();
  return (
    <div
      className={`flex items-center gap-2 ${dim ? 'opacity-70' : ''} ${className}`}
      data-testid="brand-header"
    >
      <img src="/logo.png" alt="Altan Domog" className="h-7 w-auto" />
      <span className="flex flex-col items-start leading-none">
        <span
          className="font-display text-sm text-ivory tracking-wide"
          style={{ fontVariationSettings: '"opsz" 36, "SOFT" 50, "wght" 480' }}
        >
          {lang === 'en' ? 'Altan Domog' : 'Алтан Домог'}
        </span>
        <span className="font-meta text-[7px] tracking-[0.3em] text-brass/70 mt-1">
          MMXXVI
        </span>
      </span>
    </div>
  );
}

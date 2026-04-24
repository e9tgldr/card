import { useEffect, useRef } from 'react';
import { TIMELINE_ITEMS } from '@/lib/figuresData';
import { useLang } from '@/lib/i18n';
import CodexRule from '@/components/ornaments/CodexRule';
import SealMark from '@/components/ornaments/SealMark';

export default function TimelineSection() {
  const containerRef = useRef(null);
  const { t, lang } = useLang();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.15 }
    );
    const items = containerRef.current?.querySelectorAll('.tl-item');
    items?.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative py-24 px-4" ref={containerRef}>
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div className="text-center space-y-5 mb-16">
          <CodexRule caption={t('codex.chapter.VI')} fleuronSize={22} />
          <h2 className="display-title text-[clamp(2.2rem,5vw,4rem)] text-ivory">
            {t('timeline.title.prefix')}{' '}
            {t('timeline.title.mid') && <span className="text-seal">{t('timeline.title.mid')} </span>}
            {t('timeline.title.suffix')}
          </h2>
          <p className="max-w-lg mx-auto prose-body italic text-ivory/70">
            {t('timeline.subtitle')}
          </p>
        </div>

        <div className="relative">
          {/* Center line - desktop */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-brass/50 to-transparent -translate-x-1/2 hidden md:block" />
          {/* Left line - mobile */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-brass/50 to-transparent md:hidden" />

          <div className="space-y-10 md:space-y-14">
            {TIMELINE_ITEMS.map((item, idx) => {
              const isLeft = idx % 2 === 0;
              const roman = toRoman(idx + 1);
              return (
                <div
                  key={idx}
                  className="tl-item reveal relative"
                  style={{ transitionDelay: `${Math.min(idx * 50, 500)}ms` }}
                >
                  {/* Mobile */}
                  <div className="md:hidden flex items-start gap-5 pl-1">
                    <div className="flex-shrink-0 relative w-8 h-8 mt-1 flex items-center justify-center z-10">
                      <SealMark size={26} variant="filled" />
                    </div>
                    <div className="space-y-1 pb-2">
                      <span className="font-meta text-[9px] tracking-[0.3em] uppercase text-brass/70">{roman}. · {item.era}</span>
                      <h3
                        className="font-display text-lg text-ivory leading-tight"
                        style={{ fontVariationSettings: '"opsz" 36, "SOFT" 50' }}
                      >
                        {lang === 'en' ? (item.title_en || item.title) : item.title}
                      </h3>
                      <p className="font-prose italic text-sm text-ivory/70 leading-relaxed">
                        {lang === 'en' ? (item.desc_en || item.desc) : item.desc}
                      </p>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:flex items-center gap-10">
                    <div className={`flex-1 ${isLeft ? 'text-right' : ''}`}>
                      {isLeft && (
                        <div className="space-y-1.5">
                          <span className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass/80 inline-block">
                            {roman}. · {item.era}
                          </span>
                          <h3
                            className="font-display text-xl text-ivory leading-tight"
                            style={{ fontVariationSettings: '"opsz" 48, "SOFT" 60' }}
                          >
                            {lang === 'en' ? (item.title_en || item.title) : item.title}
                          </h3>
                          <p className="font-prose italic text-sm text-ivory/70 leading-relaxed">
                            {lang === 'en' ? (item.desc_en || item.desc) : item.desc}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 relative w-9 h-9 flex items-center justify-center z-10 bg-ink">
                      <SealMark size={30} variant="filled" />
                    </div>
                    <div className="flex-1">
                      {!isLeft && (
                        <div className="space-y-1.5">
                          <span className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass/80 inline-block">
                            {roman}. · {item.era}
                          </span>
                          <h3
                            className="font-display text-xl text-ivory leading-tight"
                            style={{ fontVariationSettings: '"opsz" 48, "SOFT" 60' }}
                          >
                            {lang === 'en' ? (item.title_en || item.title) : item.title}
                          </h3>
                          <p className="font-prose italic text-sm text-ivory/70 leading-relaxed">
                            {lang === 'en' ? (item.desc_en || item.desc) : item.desc}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// Convert 1..49 to small roman numerals (enough for timeline)
function toRoman(n) {
  const map = [
    [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let res = '';
  for (const [v, s] of map) {
    while (n >= v) { res += s; n -= v; }
  }
  return res;
}

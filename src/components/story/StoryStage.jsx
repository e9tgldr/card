import { useMemo } from 'react';
import { FIGURES, ERAS } from '@/lib/figuresData';
import { useLang, figureName, storyText } from '@/lib/i18n';
import KenBurnsPortrait from './KenBurnsPortrait';
import StoryMapPanel from './StoryMapPanel';
import Subtitles from './Subtitles';

export default function StoryStage({ slide, charIndex = 0, className = '' }) {
  const { lang } = useLang();

  const { text, caption, figure, era } = useMemo(() => {
    if (!slide) return {};
    if (slide.kind === 'figure') {
      const f = slide.figure;
      return {
        text: storyText(f, lang),
        caption: `${figureName(f, lang)} · ${f.yrs}`,
        figure: f,
        era: null,
      };
    }
    const eraDef = ERAS[slide.era] || {};
    if (slide.kind === 'intro') {
      const years = lang === 'en' ? (eraDef.years_en || eraDef.years) : eraDef.years;
      const intro = lang === 'en' ? (eraDef.intro_en || eraDef.intro) : eraDef.intro;
      return {
        text: `${eraDef.label} · ${years}. ${intro ?? ''}`,
        caption: `${eraDef.roman} · ${lang === 'en' ? (eraDef.label_en || eraDef.label) : eraDef.label}`,
        figure: null,
        era: slide.era,
      };
    }
    const done = lang === 'en' ? `Chapter ${eraDef.roman} complete.` : `Бүлэг ${eraDef.roman} дуусав.`;
    return { text: done, caption: done, figure: null, era: slide.era };
  }, [slide, lang]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      <KenBurnsPortrait figure={figure || FIGURES[0]} className="aspect-[4/5] md:aspect-auto md:min-h-[26rem]" />
      <StoryMapPanel figure={figure} era={era ?? slide?.era} className="aspect-[4/5] md:aspect-auto md:min-h-[26rem]" />
      <div className="md:col-span-2 space-y-2">
        <p className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass/80">{caption}</p>
        <Subtitles text={text} charIndex={charIndex} />
      </div>
    </div>
  );
}

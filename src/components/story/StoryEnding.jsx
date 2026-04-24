import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import { ERAS } from '@/lib/figuresData';
import { nextEra } from '@/lib/storyPlaylist';
import Fleuron from '@/components/ornaments/Fleuron';

export default function StoryEnding({ currentEra }) {
  const { t, lang } = useLang();
  const next = nextEra(currentEra);
  const nextDef = next ? ERAS[next] : null;

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-6 text-center px-6 py-14">
      <Fleuron size={48} className="opacity-80" />
      <h2 className="font-display text-3xl md:text-4xl text-ivory">{t('story.ending.title')}</h2>
      {next ? (
        <Link
          to={`/story/${next}`}
          className="inline-flex items-center gap-3 px-6 py-3 border-2 border-brass text-brass hover:text-ivory hover:border-ivory font-display tracking-wide transition-colors"
        >
          <span className="font-meta text-[10px] tracking-[0.3em] uppercase">
            {t('story.ending.continue')}
          </span>
          <span>
            {nextDef.roman} · {lang === 'en' ? (nextDef.label_en || nextDef.label) : nextDef.label}
          </span>
          <span>→</span>
        </Link>
      ) : (
        <p className="font-prose italic text-ivory/70 max-w-md">{t('story.ending.done')}</p>
      )}
    </div>
  );
}

import raw from '../../../../docs/brand-book/00-cover.md?raw';
import { parseChapter } from '../parseChapter';

const c = parseChapter(raw);

export default function Cover() {
  return (
    <>
      <section id="cover" className="bg-ink text-ivory min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="w-32 h-32 rounded-full border border-brass/60 flex items-center justify-center mb-12">
          <span lang="mn" className="font-display text-2xl text-brass">{c.TITLE_MN}</span>
        </div>
        <p lang="mn" className="font-prose text-ivory text-lg max-w-md">{c.TAGLINE_MN}</p>
        <p lang="en" className="font-meta text-brass/70 text-xs uppercase tracking-widest mt-3">{c.TAGLINE_EN}</p>
      </section>
      <section id="cover-inside" className="bg-ink text-ivory min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p lang="mn" className="font-display text-xl md:text-2xl text-ivory max-w-md italic mb-3">
          {c.DEDICATION_MN}
        </p>
        <p lang="en" className="font-prose text-ivory-dim text-sm italic">
          {c.DEDICATION_EN}
        </p>
      </section>
    </>
  );
}

import raw from '../../../../docs/brand-book/09-credibility.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

export default function Credibility() {
  return (
    <>
      <Plate number="IX" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="credibility">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-meta text-seal text-xs uppercase tracking-widest border border-seal/60 px-2 py-1">[FILL] STUB</span>
          <h2 lang="mn" className="font-display text-3xl md:text-5xl">{c.TITLE_MN}</h2>
        </div>
        <EditorialBody mn={c.MN} en={c.EN} />
      </Spread>
    </>
  );
}

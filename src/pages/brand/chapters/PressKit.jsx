import raw from '../../../../docs/brand-book/10-press-kit.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

export default function PressKit() {
  return (
    <>
      <Plate number="X" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="press-kit">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        <div className="mt-16 border-t border-brass/30 pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="font-meta text-brass text-xs uppercase tracking-widest mb-2">Тайлбар (MN)</p>
            <p lang="mn" className="font-prose text-ivory text-sm">{c.SHORT_DESC_MN}</p>
          </div>
          <div>
            <p className="font-meta text-brass text-xs uppercase tracking-widest mb-2">Description (EN)</p>
            <p lang="en" className="font-prose text-ivory-dim text-sm italic">{c.SHORT_DESC_EN}</p>
          </div>
        </div>
        <p className="font-meta text-brass text-sm mt-12">→ {c.CONTACT}</p>
      </Spread>
    </>
  );
}

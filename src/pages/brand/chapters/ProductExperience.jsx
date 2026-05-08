import raw from '../../../../docs/brand-book/03-product-experience.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

function parseCalloutLines(raw) {
  if (!raw) return [];
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split('|').map((s) => s.trim()));
}

export default function ProductExperience() {
  const modules = c.CALLOUTS || parseCalloutLines(c.CALLOUTS_RAW);
  return (
    <>
      <Plate number="III" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="product-experience">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        {modules.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-16 border-t border-brass/30 pt-8">
            {modules.map((row, i) => (
              <li key={i} className="border-l border-brass/40 pl-4">
                <span lang="mn" className="font-display text-xl text-ivory block">{row[0]}</span>
                <span lang="en" className="font-meta text-brass/70 text-xs uppercase tracking-widest block mt-1">{row[1]}</span>
              </li>
            ))}
          </ul>
        )}
      </Spread>
    </>
  );
}

import raw from '../../../../docs/brand-book/02-the-52.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';
import MarginNote from '../primitives/MarginNote';

const c = parseChapter(raw);

export default function The52() {
  return (
    <>
      <Plate number="II" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="the-52">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        {c.NOTE && (
          <div className="mt-12 max-w-md">
            <MarginNote>Designer note</MarginNote>
            <p className="font-prose text-ivory-dim text-sm italic mt-2">{c.NOTE}</p>
          </div>
        )}
      </Spread>
    </>
  );
}

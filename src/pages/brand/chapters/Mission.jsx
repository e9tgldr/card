import raw from '../../../../docs/brand-book/01-mission.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import EditorialBody from '../primitives/EditorialBody';
import PullQuote from '../primitives/PullQuote';

const c = parseChapter(raw);

export default function Mission() {
  return (
    <>
      <Plate number="I" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="mission">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        {c.QUOTE && <PullQuote text={c.QUOTE} attribution={c.ATTRIBUTION} />}
      </Spread>
    </>
  );
}

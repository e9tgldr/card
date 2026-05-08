import raw from '../../../../docs/brand-book/05-anatomy-of-card.md?raw';
import { parseChapter } from '../parseChapter';
import Plate from '../primitives/Plate';
import Spread from '../primitives/Spread';
import Specimen from '../primitives/Specimen';
import EditorialBody from '../primitives/EditorialBody';

const c = parseChapter(raw);

function PlaceholderCard() {
  return (
    <div
      role="img"
      aria-label="Placeholder card showing the seven anatomy regions"
      className="w-64 h-96 bg-card border border-brass/60 rounded-md p-4 flex flex-col justify-between shadow-lg"
    >
      <div className="h-40 border border-brass/30 rounded-sm flex items-center justify-center font-meta text-brass/40 text-xs">
        ① PORTRAIT
      </div>
      <div className="space-y-2">
        <div className="font-display text-ivory text-sm">② НЭР</div>
        <div className="font-meta text-brass/70 text-[10px] uppercase tracking-widest">③ ERA</div>
        <div className="font-meta text-brass/70 text-[10px]">④ ⚔</div>
        <div className="font-prose text-ivory-dim text-xs italic">"⑤ Quote line"</div>
        <div className="flex justify-between items-end pt-2 border-t border-brass/30">
          <span className="font-meta text-brass/60 text-[10px]">⑥ SOURCE</span>
          <span className="font-meta text-brass text-[10px]">⑦ ★</span>
        </div>
      </div>
    </div>
  );
}

export default function AnatomyOfCard() {
  return (
    <>
      <Plate number="V" titleMn={c.TITLE_MN} titleEn={c.TITLE_EN} />
      <Spread id="anatomy">
        <h2 lang="mn" className="font-display text-3xl md:text-5xl mb-12">{c.TITLE_MN}</h2>
        <EditorialBody mn={c.MN} en={c.EN} />
        <div className="mt-16 border-t border-brass/30 pt-12">
          <Specimen callouts={c.CALLOUTS || []}>
            <PlaceholderCard />
          </Specimen>
        </div>
      </Spread>
    </>
  );
}

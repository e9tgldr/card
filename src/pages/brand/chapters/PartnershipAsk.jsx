import raw from '../../../../docs/brand-book/08-partnership-ask.md?raw';
import { parseChapter } from '../parseChapter';
import Spread from '../primitives/Spread';

const c = parseChapter(raw);

export default function PartnershipAsk() {
  const asks = c.ASK || [];
  return (
    <Spread id="partnership-ask">
      <div className="flex items-end gap-6 mb-12">
        <span className="font-display text-7xl md:text-9xl text-brass leading-none">{asks.length || 9}</span>
        <h2 lang="mn" className="font-display text-3xl md:text-5xl pb-2">{c.TITLE_MN}</h2>
      </div>
      <p lang="mn" className="font-prose text-ivory text-lg max-w-3xl">{c.MN}</p>
      <p lang="en" className="font-prose text-ivory-dim text-sm italic max-w-3xl mt-2 mb-12">{c.EN}</p>
      <ul className="divide-y divide-brass/30 border-t border-b border-brass/30">
        {asks.map((row, i) => (
          <li key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 py-4">
            <div className="md:col-span-3">
              <span lang="mn" className="font-display text-ivory text-base">{row[0]}</span>
              <span lang="en" className="font-meta text-brass/70 text-[10px] uppercase tracking-widest block">{row[1]}</span>
            </div>
            <div className="md:col-span-9">
              <span lang="mn" className="font-prose text-ivory-dim text-sm">{row[2]}</span>
              <span className="mx-2 text-ivory-dim/40">·</span>
              <span lang="en" className="font-prose text-ivory-dim/70 text-xs italic">{row[3]}</span>
            </div>
          </li>
        ))}
      </ul>
      {c.NOTE && (
        <p className="font-meta text-brass text-xs uppercase tracking-widest mt-12">
          → {c.NOTE.replace(/^Contact line:\s*/i, '')}
        </p>
      )}
    </Spread>
  );
}

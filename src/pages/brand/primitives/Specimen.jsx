export default function Specimen({ callouts = [], children }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
      <div className="flex items-center justify-center">{children}</div>
      <ol className="space-y-5">
        {callouts.map((row, i) => {
          const [num, mn, en] = row;
          return (
            <li key={i} data-callout className="flex gap-4 items-baseline border-t border-brass/30 pt-3">
              <span className="font-meta text-brass text-xs">{num}</span>
              <div className="flex-1">
                <span lang="mn" className="font-prose text-ivory text-base">{mn}</span>
                <span className="mx-2 text-ivory-dim/40">·</span>
                <span lang="en" className="font-prose text-ivory-dim text-sm italic">{en}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

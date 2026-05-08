function paras(text) {
  return (text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export default function EditorialBody({ mn, en }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
      <div className="md:col-span-7 space-y-5">
        {paras(mn).map((p, i) => (
          <p key={i} lang="mn" className="font-prose text-ivory text-lg leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      <div className="md:col-span-5 space-y-4 md:border-l md:border-brass/30 md:pl-8">
        {paras(en).map((p, i) => (
          <p key={i} lang="en" className="font-prose text-ivory-dim text-sm italic leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

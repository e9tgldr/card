export default function Plate({ number, titleMn, titleEn, imageSrc }) {
  return (
    <section
      role="img"
      aria-label={`Plate ${number} — ${titleEn}`}
      className="relative w-full h-screen bg-ink overflow-hidden"
      style={imageSrc ? { backgroundImage: `url(${imageSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <span className="absolute left-8 bottom-8 font-meta text-brass text-sm uppercase tracking-widest">
        Plate <span>{number}</span>
      </span>
      <div className="absolute inset-x-0 bottom-0 border-t border-brass/40 py-6 text-center">
        <h2 lang="mn" className="font-display text-3xl md:text-4xl text-ivory">
          {titleMn}
        </h2>
        <p lang="en" className="font-meta text-brass/70 text-xs mt-1 uppercase tracking-widest">
          {titleEn}
        </p>
      </div>
    </section>
  );
}

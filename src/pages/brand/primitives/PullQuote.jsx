export default function PullQuote({ text, attribution }) {
  return (
    <blockquote className="my-12 border-l-2 border-brass pl-6 max-w-2xl">
      <p className="font-display text-2xl md:text-3xl leading-snug text-ivory italic">
        {text}
      </p>
      {attribution && (
        <footer className="font-meta text-brass text-xs uppercase tracking-wider mt-3">
          {attribution}
        </footer>
      )}
    </blockquote>
  );
}

export default function Spread({ id, children, className = '' }) {
  return (
    <section
      id={id}
      className={`bg-ink text-ivory min-h-screen px-6 md:px-16 py-16 md:py-24 ${className}`}
    >
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

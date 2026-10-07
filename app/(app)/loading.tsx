export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="h-3 w-24 rounded bg-line" />
      <div className="mt-4 h-8 w-56 rounded bg-line" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-line-soft" />
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}

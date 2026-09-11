/* Skeleton de /learn. Tarjetas con imagen 4:3 como las reales. */
export default function LearnLoading() {
  return (
    <section className="mx-auto max-w-5xl animate-pulse px-6 py-16" aria-busy="true" aria-live="polite">
      <div className="h-3 w-16 rounded bg-zinc-200" />
      <div className="mt-3 h-9 w-72 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-2/3 max-w-lg rounded bg-zinc-100" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
            <div className="aspect-[4/3] bg-zinc-100" />
            <div className="space-y-3 p-6">
              <div className="h-3 w-12 rounded bg-zinc-100" />
              <div className="h-5 w-3/4 rounded bg-zinc-200" />
              <div className="h-3 w-full rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

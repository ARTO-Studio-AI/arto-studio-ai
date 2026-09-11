/* Skeleton de /work mientras carga el segmento. Sin texto: solo la forma. */
export default function WorkLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-6 py-16" aria-busy="true" aria-live="polite">
      <div className="h-3 w-24 rounded bg-zinc-200" />
      <div className="mt-4 h-10 w-2/3 max-w-md rounded bg-zinc-200" />
      <div className="mt-4 h-4 w-1/2 max-w-sm rounded bg-zinc-100" />
      <div className="mt-16 grid gap-8 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
            <div className="aspect-[16/10] bg-zinc-100" />
            <div className="space-y-3 p-6">
              <div className="h-3 w-16 rounded bg-zinc-100" />
              <div className="h-5 w-1/2 rounded bg-zinc-200" />
              <div className="h-3 w-3/4 rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

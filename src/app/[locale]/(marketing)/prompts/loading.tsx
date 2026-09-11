/* Skeleton del catalogo de prompts. Misma rejilla que la pagina real. */
export default function PromptsLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-6 py-12" aria-busy="true" aria-live="polite">
      <div className="h-8 w-40 rounded bg-zinc-200" />
      <div className="mt-2 h-3 w-48 rounded bg-zinc-100" />
      <div className="mt-6 h-24 rounded-[var(--radius-lg)] border border-zinc-200 bg-white" />
      <div className="mt-4 h-40 rounded-[var(--radius-lg)] border border-zinc-200 bg-white" />
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <li key={i} className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-4">
            <div className="flex justify-between">
              <div className="h-3 w-16 rounded bg-zinc-100" />
              <div className="h-4 w-10 rounded-full bg-zinc-100" />
            </div>
            <div className="mt-3 h-4 w-5/6 rounded bg-zinc-200" />
            <div className="mt-2 h-4 w-2/3 rounded bg-zinc-200" />
            <div className="mt-4 flex gap-2">
              <div className="h-4 w-14 rounded-full bg-zinc-100" />
              <div className="h-4 w-14 rounded-full bg-zinc-100" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

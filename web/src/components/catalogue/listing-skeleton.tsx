export function ListingSkeleton({ collection = false }: { collection?: boolean }) {
  return (
    <main className="site-container pt-24 pb-32 lg:pt-32 lg:pb-20" aria-busy="true" aria-label="Loading pieces">
      <p role="status" className="sr-only">Loading pieces…</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        {collection ? <div className="mb-6 h-6 w-36 rounded bg-paper" /> : null}
        <div className="h-20 w-2/3 rounded bg-paper" />
        <div className="mt-6 mb-6 h-12 max-w-2xl rounded-full bg-paper" />
        <div className="h-16 border-y border-line bg-paper" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="hidden h-[40rem] rounded bg-paper lg:block" />
          <div className="grid grid-cols-1 gap-x-3 gap-y-7 min-[340px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, index) => (
              <div key={index}>
                <div className="aspect-square rounded-[var(--radius-card)] bg-paper" />
                <div className="mt-3 h-12 rounded bg-paper" />
                <div className="mt-2 h-6 w-3/4 rounded bg-paper" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

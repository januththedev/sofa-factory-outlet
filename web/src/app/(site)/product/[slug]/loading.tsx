export default function Loading() {
  return (
    <main className="site-container pt-24 pb-48 lg:pt-32" aria-busy="true" aria-label="Loading product">
      <p role="status" className="sr-only">Loading product…</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-4 h-11 w-40 rounded bg-paper" />
        <div className="mb-6 h-6 w-2/3 rounded bg-paper" />
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-7">
            <div className="aspect-square rounded-[var(--radius-card)] bg-paper" />
            <div className="mt-2 h-11 rounded bg-paper" />
            <div className="mt-2 flex gap-3">
              {[0, 1, 2].map((index) => <div key={index} className="h-16 w-16 rounded bg-paper" />)}
            </div>
          </div>
          <div className="space-y-6 lg:col-span-5 lg:pt-8">
            <div className="h-4 w-24 rounded bg-paper" />
            <div className="h-28 rounded bg-paper" />
            <div className="h-8 w-40 rounded bg-paper" />
            <div className="h-16 rounded bg-paper" />
            <div className="h-36 rounded bg-paper" />
          </div>
        </div>
        <div className="mt-10 h-64 border-y border-line bg-paper" />
      </div>
    </main>
  );
}

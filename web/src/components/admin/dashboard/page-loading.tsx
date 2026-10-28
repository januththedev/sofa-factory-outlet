export function AdminPageLoading({ label = 'records' }: { label?: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="space-y-6">
      <span className="sr-only">Loading {label}…</span>
      <div aria-hidden className="space-y-6">
        <div className="h-10 w-2/3 max-w-80 rounded-xl bg-bone-2" />
        <div className="h-36 rounded-[var(--radius-card)] border border-line bg-paper" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-64 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="h-6 w-2/3 rounded bg-bone-2" />
              <div className="mt-4 h-20 rounded bg-bone-2" />
              <div className="mt-4 h-11 rounded-full bg-bone-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OpsLoading() {
  return (
    <div role="status" aria-live="polite" className="min-w-0 space-y-6">
      <p className="text-base text-mute">Loading this page…</p>
      <div aria-hidden="true" className="h-20 rounded-xl bg-bone-2" />
      <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-44 rounded-xl border border-line bg-paper" />)}
      </div>
    </div>
  );
}

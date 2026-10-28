/** Shared empty state for the Visitors panels. */
export function NoData({ label = 'No data yet' }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-mute">{label}</p>;
}

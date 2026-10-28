/** Shared empty state for the Visitors panels. */
export function NoData({ label = 'No data yet' }: { label?: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-base text-mute">{label}</p>
      <p
        className="mt-2 text-base sm:text-sm text-mute"
      >
        Check again after new visits or bookings, or choose another date range.
      </p>
    </div>
  );
}

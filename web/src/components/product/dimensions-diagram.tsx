import type { Dimensions } from '@/lib/db/schema/types';

const labels: Record<string, string> = {
  widthCm: 'Width',
  depthCm: 'Depth',
  heightCm: 'Height',
  seatHeightCm: 'Seat height',
  seatDepthCm: 'Seat depth',
};

export function DimensionsDiagram({ dimensions }: { dimensions: Dimensions | null }) {
  if (!dimensions || !Object.values(dimensions).some((value) => value != null)) return null;
  const entries = Object.entries(dimensions)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number');
  return (
    <figure className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <svg viewBox="0 0 360 125" role="img" aria-label="Product dimensions diagram" className="w-full">
        <path d="M55 105h250V55H80v50M80 55 55 80m250-25 20 25"
          fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <figcaption>
        <dl className="grid grid-cols-2 gap-3 text-base">
          {entries.map(([key, value]) => (
            <div key={key}><dt>{labels[key] ?? key}</dt><dd>{value} cm</dd></div>
          ))}
        </dl>
        {dimensions.note ? <p className="mt-3 text-base">{dimensions.note}</p> : null}
      </figcaption>
    </figure>
  );
}

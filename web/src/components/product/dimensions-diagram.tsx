import type { Dimensions } from '@/lib/db/schema/types';

export function DimensionsDiagram({ dimensions }: { dimensions: Dimensions | null }) {
  if (!dimensions || !Object.values(dimensions).some((value) => value != null)) return null;
  const entries = Object.entries(dimensions).filter((entry): entry is [string, number] => typeof entry[1] === 'number');
  return (
    <figure className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
      <svg viewBox="0 0 360 150" role="img" aria-labelledby="dimensions-title" className="w-full">
        <title id="dimensions-title">Product dimensions diagram</title>
        <path d="M55 105h250V55H80v50M80 55 55 80m250-25 20 25" fill="none" stroke="currentColor" strokeWidth="2" />
        {entries.map(([key, value], index) => <text key={key} x={70 + index * 90} y={135} className="fill-current text-[11px]">{key}: {value} cm</text>)}
      </svg>
    </figure>
  );
}

// Line illustrations for the four factory steps. Paths carry pathLength="1" and
// data-draw so the story can draw them in with stroke-dashoffset. They are
// drawings, not photographs, until the client supplies photos of the workshop.

// No non-scaling-stroke here: with it, stroke-dasharray stops following pathLength and the draw-in breaks.
const common = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Draw({ d, className, width = 2 }: { d: string; className?: string; width?: number }) {
  return <path data-draw pathLength={1} d={d} className={className} strokeWidth={width} {...common} />;
}

export function FrameArt() {
  return (
    <svg viewBox="0 0 480 360" role="img" aria-label="Line drawing of a timber sofa frame" className="h-full w-full text-bone">
      <g stroke="currentColor">
        {/* seat rail and base */}
        <Draw d="M60 250 H420 V280 H60 Z" />
        <Draw d="M60 250 L110 222 H470 L420 250" />
        <Draw d="M420 280 L470 252 V222" />
        {/* back frame */}
        <Draw d="M72 250 V110 Q72 96 86 96 H394 Q408 96 408 110 V250" />
        <Draw d="M72 150 H408" />
        <Draw d="M72 200 H408" />
        <Draw d="M180 96 V250 M300 96 V250" />
        {/* arms */}
        <Draw d="M60 250 V176 Q60 160 76 160 H116 V250" />
        <Draw d="M420 250 V176 Q420 160 404 160 H364 V250" />
        {/* legs */}
        <Draw d="M84 280 V318 M396 280 V318 M124 262 V310" />
      </g>
      <g stroke="var(--color-clay)">
        {/* corner brackets and joints */}
        <Draw d="M60 250 h22 v-22" width={2.5} />
        <Draw d="M420 250 h-22 v-22" width={2.5} />
        <Draw d="M72 118 h22 M408 118 h-22" width={2.5} />
      </g>
    </svg>
  );
}

export function FoamArt() {
  return (
    <svg viewBox="0 0 480 360" role="img" aria-label="Line drawing of stacked foam slabs" className="h-full w-full text-bone">
      <g stroke="currentColor">
        <Draw d="M90 110 Q90 92 108 92 H372 Q390 92 390 110 V150 Q390 168 372 168 H108 Q90 168 90 150 Z" />
        <Draw d="M70 182 Q70 164 88 164 H392 Q410 164 410 182 V222 Q410 240 392 240 H88 Q70 240 70 222 Z" />
        <Draw d="M90 254 Q90 236 108 236 H372 Q390 236 390 254 V294 Q390 312 372 312 H108 Q90 312 90 294 Z" />
      </g>
      <g stroke="var(--color-clay)" strokeDasharray="1 9">
        <Draw d="M120 130 H360" width={7} />
        <Draw d="M100 203 H380" width={7} />
        <Draw d="M120 275 H360" width={7} />
      </g>
      <g stroke="var(--color-clay)">
        <Draw d="M430 100 V300 M420 112 l10 -12 l10 12 M420 288 l10 12 l10 -12" width={2} />
      </g>
    </svg>
  );
}

const SWATCHES = ['#53352a', '#842323', '#c9a88a', '#3e7a52', '#6f6862'];

export function FabricArt() {
  return (
    <svg viewBox="0 0 480 360" role="img" aria-label="Line drawing of fabric swatches" className="h-full w-full text-bone">
      <defs>
        <pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0H8" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
        </pattern>
      </defs>
      {SWATCHES.map((fill, index) => (
        <g key={fill} transform={`translate(${70 + index * 62} 300) rotate(${-34 + index * 17})`}>
          <rect data-fade x="0" y="-200" width="150" height="200" rx="10" fill={fill} fillOpacity="0.9" />
          <rect x="0" y="-200" width="150" height="200" rx="10" fill="url(#weave)" />
          <path data-draw pathLength={1} d="M0 -200 H150 a10 10 0 0 1 10 10 V-10 a10 10 0 0 1 -10 10 H0 Z" stroke="currentColor" strokeWidth="1.5" {...common} fill="none" transform="translate(0 0)" strokeOpacity="0.9" />
        </g>
      ))}
      <circle data-fade cx="378" cy="96" r="7" fill="var(--color-clay)" />
    </svg>
  );
}

export function FinishArt() {
  return (
    <svg viewBox="0 0 480 360" role="img" aria-label="Line drawing of a finished sofa with stitching" className="h-full w-full text-bone">
      <g stroke="currentColor">
        <Draw d="M60 250 Q60 226 84 226 H396 Q420 226 420 250 V282 H60 Z" />
        <Draw d="M84 226 V150 Q84 120 114 120 H366 Q396 120 396 150 V226" />
        <Draw d="M40 232 Q40 200 70 200 Q96 200 96 232 V282 H40 Z" />
        <Draw d="M440 232 Q440 200 410 200 Q384 200 384 232 V282 H440 Z" />
        <Draw d="M96 226 H384" />
        <Draw d="M240 120 V226" />
        <Draw d="M90 282 V310 M390 282 V310" />
      </g>
      <g stroke="var(--color-clay)" strokeDasharray="6 7">
        <Draw d="M110 238 H230 M250 238 H370" width={1.6} />
        <Draw d="M112 140 H230 M250 140 H368" width={1.6} />
      </g>
      <g stroke="var(--color-clay)">
        <circle data-fade cx="380" cy="80" r="26" strokeWidth="2" fill="none" />
        <Draw d="M368 80 l9 10 l17 -20" width={3} />
      </g>
    </svg>
  );
}

export const FACTORY_ART = [FrameArt, FoamArt, FabricArt, FinishArt];

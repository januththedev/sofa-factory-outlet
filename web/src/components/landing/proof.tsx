import type { PublicReview } from '@/lib/catalogue/cached';
import type { ProofSettings } from '@/lib/settings/types';
import { CountUp } from './count-up';
import { SwipeRail } from './swipe-rail';

// The six reasons come from the captured About page ("Why choose us").
const REASONS = [
  { title: 'Premium materials', body: 'Durable fabrics, strong wooden frames and high-density cushioning.' },
  {
    title: 'Skilled craftsmanship',
    body: 'Every sofa is crafted by experienced technicians who care about finishing.',
  },
  { title: 'Made your way', body: 'Choose the fabric, size, colour and layout. We build to suit your space.' },
  { title: 'Islandwide delivery', body: 'Fast, reliable delivery to your doorstep anywhere in Sri Lanka.' },
  { title: 'Factory-direct prices', body: 'No middleman and no showroom markup.' },
  { title: 'After-sales support', body: 'Help with repairs, adjustments and questions after you take it home.' },
];

function Stars({ rating }: { rating: number }) {
  return (
    <p aria-label={`${rating} out of 5 stars`} className="text-maroon">
      {'?'.repeat(rating)}
      <span className="text-ink/20">{'?'.repeat(5 - rating)}</span>
    </p>
  );
}

export function Proof({ proof, reviews }: { proof: ProofSettings; reviews: PublicReview[] }) {
  const counters = [
    { value: proof.years, label: 'years making sofas' },
    { value: proof.homes, label: 'homes furnished', suffix: '+' },
    { value: proof.districts, label: 'districts delivered to' },
  ].filter((counter): counter is { value: number; label: string; suffix?: string } => (
    typeof counter.value === 'number'
  ));

  return (
    <section aria-labelledby="proof-heading" className="bg-bone-2 py-10 lg:py-36">
      <div className="site-container">
        <div className="grid gap-5 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-6">
            <p className="eyebrow text-xs">Why people choose us</p>
            <h2
              id="proof-heading"
              className="mt-3 max-w-[15ch] text-[clamp(2rem,5.2vw,5rem)] font-light leading-[1]"
            >
              Made here. Sold without a middleman.
            </h2>
          </div>
          {counters.length ? (
            <dl className="grid grid-cols-3 gap-3 self-end lg:col-span-6 lg:gap-6">
              {counters.map((counter) => (
                <div key={counter.label} className="flex min-w-0 flex-col">
                  <dt className="order-2 mt-2 text-xs text-mute lg:text-sm">{counter.label}</dt>
                  <dd className="break-words font-display text-3xl font-light text-maroon sm:text-5xl lg:text-7xl">
                    <CountUp value={counter.value} suffix={counter.suffix} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <SwipeRail label="Why people choose us" className="mt-5 lg:mt-16" gridOnDesktop>
          {REASONS.map((reason, index) => (
            <li
              key={reason.title}
              className="min-h-48 w-[86%] shrink-0 snap-start border-t border-ink/15 pt-4
                sm:w-[46%] lg:w-auto lg:pt-6"
            >
              <p className="font-display text-sm tracking-[0.2em] text-maroon">0{index + 1}</p>
              <h3 className="mt-2 font-display text-2xl">{reason.title}</h3>
              <p className="mt-2 max-w-sm text-base leading-snug text-ink-2">{reason.body}</p>
            </li>
          ))}
        </SwipeRail>
        {reviews.length ? (
          <div className="mt-7 lg:mt-24">
            <p className="eyebrow text-xs">What customers say</p>
            <SwipeRail label="Customer reviews" className="mt-4 lg:mt-8" gridOnDesktop>
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="w-[86%] shrink-0 snap-start rounded-[var(--radius-card)] bg-paper p-5
                    sm:w-[46%] lg:w-auto lg:p-7"
                >
                  <Stars rating={review.rating} />
                  <blockquote className="mt-3 break-words text-base leading-relaxed text-ink-2">
                    “{review.body}”
                  </blockquote>
                  <p className="mt-4 text-sm font-semibold">
                    {review.authorName}
                    {review.verifiedVisit ? (
                      <span className="ml-2 font-normal text-mute">· visited the showroom</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </SwipeRail>
          </div>
        ) : null}
      </div>
    </section>
  );
}

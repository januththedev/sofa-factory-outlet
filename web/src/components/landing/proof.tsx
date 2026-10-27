import type { PublicReview } from '@/lib/catalogue/cached';
import type { ProofSettings } from '@/lib/settings/types';
import { CountUp } from './count-up';

// The six reasons come from the captured About page ("Why choose us").
const REASONS = [
  { title: 'Premium materials', body: 'Durable fabrics, strong wooden frames and high-density cushioning.' },
  { title: 'Skilled craftsmanship', body: 'Every sofa is crafted by experienced technicians who care about finishing.' },
  { title: 'Made your way', body: 'Choose the fabric, size, colour and layout. We build to suit your space.' },
  { title: 'Islandwide delivery', body: 'Fast, reliable delivery to your doorstep anywhere in Sri Lanka.' },
  { title: 'Factory-direct prices', body: 'No middleman and no showroom markup.' },
  { title: 'After-sales support', body: 'Help with repairs, adjustments and questions after you take it home.' },
];

function Stars({ rating }: { rating: number }) {
  return (
    <p aria-label={`${rating} out of 5 stars`} className="text-maroon">
      {'★'.repeat(rating)}
      <span className="text-ink/20">{'★'.repeat(5 - rating)}</span>
    </p>
  );
}

export function Proof({ proof, reviews }: { proof: ProofSettings; reviews: PublicReview[] }) {
  const counters = [
    { value: proof.years, label: 'years making sofas' },
    { value: proof.homes, label: 'homes furnished', suffix: '+' },
    { value: proof.districts, label: 'districts delivered to' },
  ].filter((c): c is { value: number; label: string; suffix?: string } => typeof c.value === 'number');

  return (
    <section aria-labelledby="proof-heading" className="bg-bone-2 py-24 lg:py-36">
      <div className="site-container">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="eyebrow">Why people choose us</p>
            <h2 id="proof-heading" className="mt-4 max-w-[15ch] text-[clamp(2.4rem,5.2vw,5rem)] font-light leading-[1]">
              Made here. Sold without a middleman.
            </h2>
          </div>
          {counters.length ? (
            <dl className="grid grid-cols-3 gap-6 self-end lg:col-span-6">
              {counters.map((c) => (
                <div key={c.label}>
                  <dt className="order-2 mt-2 text-sm text-mute">{c.label}</dt>
                  <dd className="font-display text-5xl font-light text-maroon lg:text-7xl">
                    <CountUp value={c.value} suffix={c.suffix} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((reason, index) => (
            <li key={reason.title} className="border-t border-ink/15 pt-6">
              <p className="font-display text-sm tracking-[0.2em] text-maroon">0{index + 1}</p>
              <h3 className="mt-3 font-display text-2xl">{reason.title}</h3>
              <p className="mt-2 max-w-sm leading-relaxed text-ink-2">{reason.body}</p>
            </li>
          ))}
        </ul>

        {reviews.length ? (
          <div className="mt-24">
            <p className="eyebrow">What customers say</p>
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-[var(--radius-card)] bg-paper p-7">
                  <Stars rating={review.rating} />
                  <blockquote className="mt-4 leading-relaxed text-ink-2">“{review.body}”</blockquote>
                  <p className="mt-5 text-sm font-semibold">
                    {review.authorName}
                    {review.verifiedVisit ? <span className="ml-2 font-normal text-mute">· visited the showroom</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

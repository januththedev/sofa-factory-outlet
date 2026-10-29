import { QuoteForm } from '@/components/leads/quote-form';
import { pageMetadata } from '@/lib/seo/metadata';
export const metadata = pageMetadata({
  title: 'Request a furniture quote',
  description:
    'Tell us about your selected pieces and get pricing from our team.',
  path: '/request-quote/',
  noindex: true,
});
export default function RequestQuotePage() {
  return (
    <div className="site-container pb-24 pt-24 lg:pt-44">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
        <header>
          <p className="eyebrow">Made for your space</p>
          <h1 className="mt-4 font-display text-5xl font-light">
            A little closer to home.
          </h1>
          <p className="mt-6 max-w-md text-lg text-ink-2">
            Request pricing for the pieces you love. Share your colours, room
            size and budget, and our team will help with the next step.
          </p>
          <ol className="mt-8 list-decimal space-y-3 pl-5 text-mute">
            <li>Tell us what you have in mind.</li>
            <li>We confirm options, prices and delivery.</li>
            <li>Choose a showroom visit whenever you are ready.</li>
          </ol>
        </header>
        <QuoteForm />
      </div>
    </div>
  );
}

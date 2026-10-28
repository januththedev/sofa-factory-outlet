import type { Metadata } from 'next';
import { CtaSection, lightGhostBtn } from '@/components/pages/cta-section';
import { PageHeader } from '@/components/pages/page-header';
import { Picture } from '@/components/picture';
import { TLink } from '@/components/site/transition';
import { siteImage } from '@/lib/images/site';
import { JsonLd, organizationJsonLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'About us',
  description:
    'Sofa Factory Outlet is one of Sri Lanka’s trusted furniture manufacturers: ' +
    'premium quality sofas, beds, chairs and custom-made furniture at factory-direct prices.',
  path: '/about-us/',
});

// Copy rebuilt from the captured About page (pages/about-us.html); facts and
// claims stay as the old site states them.
const WHY_CHOOSE_US = [
  {
    title: 'Premium quality materials',
    body:
      'We use durable fabrics, strong wooden frames and high-density cushioning ' +
      'to ensure long-lasting furniture that performs for years.',
  },
  {
    title: 'Skilled craftsmanship',
    body: 'Every sofa is crafted by experienced technicians who focus on quality, comfort and finishing.',
  },
  {
    title: 'Custom designs available',
    body: 'Choose your fabric, size, colour and layout — we build furniture that suits your space.',
  },
  {
    title: 'Islandwide delivery',
    body: 'Fast, reliable delivery to your doorstep anywhere in Sri Lanka.',
  },
  {
    title: 'Factory-direct prices',
    body: 'No middleman. No showroom markup. You receive the best possible price for premium furniture.',
  },
  {
    title: 'After-sales support',
    body: 'We stand behind every product and offer support for repairs, adjustments and inquiries.',
  },
] as const;

const MISSION_VISION = [
  {
    id: 'mission-heading',
    title: 'Our mission',
    body:
      'To provide Sri Lankans with high quality, handcrafted furniture made with comfort, durability ' +
      'and modern design in mind at truly factory direct prices.',
  },
  {
    id: 'vision-heading',
    title: 'Our vision',
    body:
      'To become Sri Lanka’s most trusted and affordable furniture brand, offering a wide range of ' +
      'premium sofas, bedroom sets and custom-made solutions that enhance every home.',
  },
] as const;

const WHO_PHOTO_ALT = 'A Sofa Factory Outlet sofa, photographed for the premium quality materials page';

const WHO_GRID = 'site-container mt-16 grid gap-10 lg:mt-24 lg:grid-cols-12 lg:gap-16';
const WHY_HEADING = 'max-w-[18ch] text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]';

export default async function AboutUsPage() {
  const organisation = await organizationJsonLd();
  const materials = siteImage('materials', WHO_PHOTO_ALT);

  return (
    <>
      <PageHeader
        eyebrow="About us"
        title="About Sofa Factory Outlet"
        lede={
          'Sofa Factory Outlet is one of Sri Lanka’s trusted furniture manufacturers, known for ' +
          'delivering premium quality sofas, beds, chairs and custom-made furniture at factory-direct prices.'
        }
      />

      <div className="site-container mt-10 max-w-[62ch] space-y-5 text-lg leading-relaxed text-ink-2">
        <p>
          For years, we’ve helped thousands of families make their homes more comfortable, stylish and long
          lasting all while offering unmatched value, craftsmanship, and customer service.
        </p>
        <p>
          At Sofa Factory Outlet, every product is handcrafted with care using high-grade materials, skilled
          workmanship, and modern production techniques to ensure durability, comfort, and elegance in every piece.
        </p>
      </div>

      <section aria-labelledby="who-we-are-heading" className={WHO_GRID}>
        <div className="lg:col-span-7">
          {/* Placeholder photo: to be replaced with our own */}
          {materials ? (
            <Picture
              data={materials}
              sizes="(min-width: 1024px) 58vw, 100vw"
              imgClassName="h-auto w-full rounded-[var(--radius-card)]"
            />
          ) : null}
        </div>
        <div className="lg:col-span-5">
          <h2 id="who-we-are-heading" className="text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]">
            Who we are
          </h2>
          <div className="mt-6 space-y-5 leading-relaxed text-ink-2">
            <p>
              We are a dedicated team of furniture makers, designers, and industry professionals passionate
              about creating furniture that matches your lifestyle. Whether you’re furnishing a new home,
              upgrading your living room, or searching for custom-made sofas, we ensure you receive premium
              quality at the best possible price.
            </p>
            <p>
              With years of experience in the furniture industry, our mission is simple: deliver top quality
              furniture that blends comfort, style, and affordability all with fast and reliable service.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="mission-heading vision-heading" className="site-container mt-20 lg:mt-28">
        <div className="grid gap-6 lg:grid-cols-2">
          {MISSION_VISION.map((block) => (
            <div key={block.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-8 lg:p-12">
              <h2 id={block.id} className="text-[clamp(1.7rem,2.8vw,2.4rem)] font-light leading-[1.05]">
                {block.title}
              </h2>
              <p className="mt-5 leading-relaxed text-ink-2">{block.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="why-choose-us-heading" className="site-container mt-20 lg:mt-28">
        <h2 id="why-choose-us-heading" className={WHY_HEADING}>
          Why choose us
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_CHOOSE_US.map((point) => (
            <li key={point.title} className="rounded-[var(--radius-card)] border border-line bg-paper p-7">
              <h3 className="text-xl font-normal">{point.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-2">{point.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="comfort-heading" className="site-container mt-20 max-w-[62ch] lg:mt-28">
        <h2 id="comfort-heading" className="text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]">
          Crafting comfort for every home
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-ink-2">
          From modern sofa sets to cozy recliners, elegant dining chairs, and stylish bedroom furniture,
          Sofa Factory Outlet offers a full range of beautifully designed furniture suitable for any home.
        </p>
        <p className="mt-5 text-lg leading-relaxed text-ink-2">
          Whether you’re decorating your apartment, upgrading your living room, or furnishing your new house,
          we are here to make your experience smooth, enjoyable, and affordable.
        </p>
      </section>

      <CtaSection
        title="Let’s make your home more comfortable"
        body={
          'Looking for the perfect sofa or custom-made furniture? ' +
          'Our team is ready to help you choose the best designs to fit your style and space.'
        }
        actions={
          <>
            <TLink href="/shop/" className="btn-primary px-7 py-4">
              Browse our collection
            </TLink>
            <TLink href="/book-visit/" className={lightGhostBtn}>
              Book a visit
            </TLink>
          </>
        }
      />

      <JsonLd data={organisation} />
    </>
  );
}

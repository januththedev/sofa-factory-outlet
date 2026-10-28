import type { ComponentType } from 'react';
import type { Metadata } from 'next';
import { FabricArt, FinishArt, FoamArt, FrameArt } from '@/components/landing/factory-art';
import { CtaSection, lightGhostBtn } from '@/components/pages/cta-section';
import { Note } from '@/components/pages/note';
import { PageHeader } from '@/components/pages/page-header';
import { TLink } from '@/components/site/transition';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'The factory story',
  description:
    'How a Sofa Factory Outlet piece is made in our own Colombo workshop: strong wooden frames, ' +
    'high-density cushioning, durable fabrics in many colours and skilled finishing.',
  path: '/factory/',
});

type Step = { title: string; art: ComponentType; lines: string[] };

// Only what the captured copy states, told in more depth than the landing page.
const STEPS: Step[] = [
  {
    title: 'Frame',
    art: FrameArt,
    lines: [
      'Every sofa starts as a strong wooden frame, cut and joined in our own workshop ' +
        'and built for Sri Lanka’s humid climate.',
      'The frame decides the shape and the strength of the finished piece, so custom sizes begin here: ' +
        'tell us the width the room allows and the piece is built to that measurement.',
    ],
  },
  {
    title: 'Foam',
    art: FoamArt,
    lines: [
      'High-density cushioning goes into every seat and back, ' +
        'so cushions stay supportive and keep their shape for years.',
      'Comfort is decided at this step. The cushioning is part of every piece we make, ' +
        'from L-shape corner sofas to 3+2+1 sets and beds.',
    ],
  },
  {
    title: 'Fabric',
    art: FabricArt,
    lines: [
      'Durable fabrics in many colours go over the frame — velvet, leather, corduroy and woven covers among them.',
      'This is where a piece becomes yours: choose the fabric, the colour and the design, ' +
        'and it is upholstered that way.',
    ],
  },
  {
    title: 'Finish',
    art: FinishArt,
    lines: [
      'Skilled hands stitch, check and finish each piece, ' +
        'with the care and finishing that experienced technicians bring to the work.',
      'Support does not stop when the piece leaves the workshop: after-sales help with repairs, ' +
        'adjustments and inquiries continues from there.',
    ],
  },
];

const CUSTOMISE = [
  {
    title: 'Fabric',
    body: 'Choose from durable fabrics — velvet, leather, corduroy and woven covers — and see them at the showroom.',
  },
  {
    title: 'Size',
    body: 'Pieces are made to order, so the size is set for your room rather than picked from a catalogue.',
  },
  {
    title: 'Colour',
    body: 'Fabrics come in many colours and designs; tell us the colour you want and we build it that way.',
  },
  {
    title: 'Layout',
    body: 'From an L-shape corner to a 3+2+1 set, the layout is chosen to suit your space.',
  },
] as const;

const STEPS_HEADING = 'max-w-[20ch] text-[clamp(2rem,4.6vw,3.8rem)] font-light leading-[1]';
const CUSTOMISE_HEADING = 'max-w-[18ch] text-[clamp(1.9rem,3.2vw,2.8rem)] font-light leading-[1.05]';

export default async function FactoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Straight from the factory floor"
        title="The factory story"
        lede={
          'Nothing here is bought ready-made and resold. Every piece is made in our own Colombo workshop ' +
          'and sold without a middleman — this is how it goes from timber to your room.'
        }
      />

      <div className="site-container mt-12">
        {/* placeholder: the client's workshop photographs and film have not been supplied yet */}
        <Note label="Photos and film on the way">
          <p>
            The workshop photographs and film are still to come from the team. Until they arrive,
            the line drawings below stand in for them — the four steps are how each piece is actually made.
          </p>
        </Note>
      </div>

      <section aria-labelledby="steps-heading" className="mt-14 bg-ink py-16 text-bone lg:mt-20 lg:py-24">
        <div className="site-container">
          <h2 id="steps-heading" className={STEPS_HEADING}>
            Four steps, start to finish
          </h2>
          <ol className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-10">
            {STEPS.map((step, index) => {
              const Art = step.art;
              return (
                <li
                  key={step.title}
                  className="rounded-[var(--radius-card)] border border-bone/15 bg-bone/[0.03] p-6 lg:p-8"
                >
                  <div className="aspect-[4/3] w-full">
                    <Art />
                  </div>
                  <p className="mt-7 font-display text-sm tracking-[0.2em] text-clay">
                    0{index + 1} / 0{STEPS.length}
                  </p>
                  <h3 className="mt-2 text-3xl font-light lg:text-4xl">{step.title}</h3>
                  {step.lines.map((line) => (
                    <p key={line} className="mt-4 leading-relaxed text-bone/75">
                      {line}
                    </p>
                  ))}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section aria-labelledby="customise-heading" className="site-container mt-20 lg:mt-28">
        <h2 id="customise-heading" className={CUSTOMISE_HEADING}>
          What you can customise
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {CUSTOMISE.map((item) => (
            <li key={item.title} className="rounded-[var(--radius-card)] border border-line bg-paper p-7">
              <h3 className="text-xl font-normal">{item.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-2">{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-[62ch] leading-relaxed text-mute">
          The team walks through fabric, size, colour and layout with you, and after-sales support for
          repairs, adjustments and inquiries continues once the piece is home.
        </p>
      </section>

      <CtaSection
        title="Come and sit on the result"
        body={
          'The factory story makes sense once you have tried a piece. Bring your room sizes ' +
          'and the team will help with the fabric, size, colour and layout.'
        }
        actions={
          <>
            <TLink href="/book-visit/" className="btn-primary px-7 py-4">
              Book a visit
            </TLink>
            <TLink href="/shop/" className={lightGhostBtn}>
              Browse the collection
            </TLink>
          </>
        }
      />
    </>
  );
}

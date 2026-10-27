'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { Picture } from '@/components/picture';
import { Magnetic } from '@/components/site/magnetic';
import { TLink } from '@/components/site/transition';
import type { PictureData } from '@/lib/images/urls';
import { gsap, MOTION_ANY } from '@/lib/motion/gsap';
import { useNearViewport } from '@/lib/motion/hooks';

type VisitProps = {
  picture: PictureData | null;
  address: { street: string; locality: string; city: string };
  hoursLines: string[] | null;
  mapSrc: string;
  directionsUrl: string;
  whatsappUrl: string | null;
};

/** Showroom section: parallax photo, address, hours (only when confirmed) and a map that loads when it nears the viewport. */
export function Visit({ picture, address, hoursLines, mapSrc, directionsUrl, whatsappUrl }: VisitProps) {
  const root = useRef<HTMLElement>(null);
  const image = useRef<HTMLDivElement>(null);
  const [mapRef, nearMap] = useNearViewport<HTMLDivElement>('500px');

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_ANY, () => {
        gsap.fromTo(
          image.current,
          { yPercent: -9 },
          { yPercent: 9, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } },
        );
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="visit-heading" className="relative isolate overflow-hidden bg-ink py-24 text-bone lg:py-36">
      {picture ? (
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div ref={image} className="absolute -inset-y-[10%] inset-x-0">
            <Picture data={picture} alt="" sizes="100vw" imgClassName="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-ink/65" />
        </div>
      ) : null}

      <div className="site-container grid gap-10 lg:grid-cols-12 lg:items-stretch">
        <div className="rounded-[var(--radius-card)] bg-bone p-8 text-ink lg:col-span-6 lg:p-12">
          <p className="eyebrow">Visit the showroom</p>
          <h2 id="visit-heading" className="mt-4 text-[clamp(2.2rem,4.6vw,4.4rem)] font-light leading-[1]">
            See it. Sit on it. Then decide.
          </h2>
          <address className="mt-8 not-italic leading-relaxed">
            <p className="font-semibold">{address.street}</p>
            <p>
              {address.locality}, {address.city}
            </p>
          </address>
          <div className="mt-6 text-ink-2">
            {hoursLines ? (
              <ul className="space-y-1">
                {hoursLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>Visits are by appointment. Pick a day and a time that suits you and we will confirm it.</p>
            )}
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <Magnetic>
              <TLink href="/book-visit/" className="btn-primary px-7 py-4">
                Book a visit
              </TLink>
            </Magnetic>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-7 py-4">
              Get directions
            </a>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-7 py-4">
                WhatsApp us
              </a>
            ) : null}
          </div>
        </div>

        <div ref={mapRef} className="min-h-[22rem] overflow-hidden rounded-[var(--radius-card)] bg-bone-2 lg:col-span-6">
          {nearMap ? (
            <iframe
              title={`Map of ${address.street}, ${address.locality}`}
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[22rem] w-full border-0 grayscale-[0.35]"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

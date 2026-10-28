'use client';

import { useRef } from 'react';
import { useState } from 'react';
import { useGSAP } from '@gsap/react';
import { Picture } from '@/components/picture';
import { Magnetic } from '@/components/site/magnetic';
import { TLink } from '@/components/site/transition';
import type { PictureData } from '@/lib/images/urls';
import { gsap } from '@/lib/motion/gsap';
import { useDesktopMotion } from './device-hooks';

type VisitProps = {
  picture: PictureData | null;
  address: { street: string; locality: string; city: string };
  hoursLines: string[] | null;
  mapSrc: string;
  directionsUrl: string;
  whatsappUrl: string | null;
};

type MapState = 'idle' | 'loading' | 'ready' | 'error';

/** A static address card makes no map request until the visitor asks for it. */
export function Visit({ picture, address, hoursLines, mapSrc, directionsUrl, whatsappUrl }: VisitProps) {
  const root = useRef<HTMLElement>(null);
  const image = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState>('idle');
  const desktopMotion = useDesktopMotion();
  const showMap = mapState === 'loading' || mapState === 'ready';

  useGSAP(() => {
    if (!desktopMotion || !image.current) return;
    gsap.fromTo(image.current, { yPercent: -9 }, {
      yPercent: 9,
      ease: 'none',
      scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }, { scope: root, dependencies: [desktopMotion], revertOnUpdate: true });

  return (
    <section
      ref={root}
      aria-labelledby="visit-heading"
      className="relative isolate overflow-hidden bg-ink py-10 text-bone lg:py-36"
    >
      {picture ? (
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div ref={image} className="absolute -inset-y-[10%] inset-x-0">
            <Picture data={picture} alt="" sizes="100vw" imgClassName="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-ink/65" />
        </div>
      ) : null}
      <div className="site-container grid items-center gap-5 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 rounded-[var(--radius-card)] bg-bone p-5 text-ink lg:col-span-6 lg:p-12">
          <p className="eyebrow text-xs">Visit the showroom</p>
          <h2
            id="visit-heading"
            className="mt-3 text-[clamp(2rem,4.6vw,4.4rem)] font-light leading-[1]"
          >
            See it. Sit on it. Then decide.
          </h2>
          <address className="mt-4 break-words text-base not-italic leading-snug lg:mt-8">
            <p className="font-semibold">{address.street}</p>
            <p>{address.locality}, {address.city}</p>
          </address>
          <div className="mt-3 text-base leading-snug text-ink-2 lg:mt-6">
            {hoursLines ? (
              <ul className="space-y-1">
                {hoursLines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : (
              <p>Visits are by appointment. Pick a day and a time that suits you and we will confirm it.</p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3 lg:mt-9">
            <Magnetic>
              <TLink href="/book-visit/" className="btn-primary min-h-11 min-w-11 px-4">
                Book a visit
              </TLink>
            </Magnetic>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost min-h-11 min-w-11 px-4"
            >
              Get directions
            </a>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost min-h-11 min-w-11 px-4"
              >
                WhatsApp us
              </a>
            ) : null}
          </div>
        </div>
        <div className="min-w-0 lg:col-span-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-bone-2 text-ink">
            <div
              className={`flex h-full flex-col items-start justify-center gap-2 p-4 sm:p-6
                ${mapState === 'ready' ? 'invisible' : ''}`}
            >
              <p className="text-base leading-snug">{address.street}, {address.locality}, {address.city}</p>
              <p role="status" className="text-xs text-ink-2">
                {mapState === 'error' ? 'The map could not load. Try again or open it in Maps.' : null}
                {mapState === 'loading' ? 'Loading the map…' : null}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={mapState === 'loading'}
                  onClick={() => setMapState('loading')}
                  className="btn-primary min-h-11 min-w-11 px-4 disabled:opacity-60"
                >
                  {mapState === 'loading' ? 'Loading the map…' : 'Show the map'}
                </button>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 min-w-11 items-center px-2 text-sm underline underline-offset-4"
                >
                  Open in Maps
                </a>
              </div>
            </div>
            {showMap ? (
              <iframe
                title={`Map of ${address.street}, ${address.locality}`}
                src={mapSrc}
                onLoad={() => setMapState('ready')}
                onError={() => setMapState('error')}
                referrerPolicy="no-referrer-when-downgrade"
                className={`absolute inset-0 h-full w-full border-0 grayscale-[0.35]
                  ${mapState === 'ready' ? '' : 'pointer-events-none opacity-0'}`}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

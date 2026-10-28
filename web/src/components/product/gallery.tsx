'use client';

import { useCallback } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Picture } from '@/components/picture';
import { getLenis } from '@/components/site/smooth-scroll';
import type { ProductVariantView } from '@/lib/catalogue/types';

export function Gallery({ variant }: { variant: ProductVariantView }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const images = variant.images;
  const safeActive = Math.min(active, Math.max(0, images.length - 1));
  const show = useCallback((index: number) => {
    setActive(index);
    viewport.current?.scrollTo({ left: viewport.current.clientWidth * index, behavior: 'instant' });
    setZoomed(false);
  }, []);
  const move = useCallback((delta: number) => {
    if (images.length) show((safeActive + delta + images.length) % images.length);
  }, [images.length, safeActive, show]);

  useEffect(() => {
    if (!lightbox) return;
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    node?.showModal();
    getLenis()?.stop();
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      getLenis()?.start();
      previous?.focus();
    };
  }, [lightbox]);

  if (!images.length) {
    return <div className="grid aspect-square place-items-center rounded-[var(--radius-card)] bg-paper">
      <p className="text-base text-mute">Photos available at your visit</p>
    </div>;
  }
  const image = images[safeActive];
  return (
    <div className="min-w-0">
      <div
        ref={viewport}
        onScroll={(event) => {
          const node = event.currentTarget;
          setActive(Math.round(node.scrollLeft / Math.max(1, node.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain
          rounded-[var(--radius-card)] bg-paper"
      >
        {images.map((item, index) => (
          <button
            key={`${item.src}:${index}`}
            type="button"
            onClick={() => {
              show(index);
              setLightbox(true);
            }}
            className="aspect-square min-h-11 min-w-11 w-full shrink-0 snap-center"
            aria-label={`Open image ${index + 1} of ${images.length}`}
          >
            <Picture
              data={item}
              sizes="(min-width: 1024px) 55vw, 92vw"
              priority={index === 0}
              placeholder={!item.cutout}
              imgClassName={`h-full w-full ${item.cutout ? 'object-contain mix-blend-multiply' : 'object-cover'}`}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 gap-2 overflow-x-auto" aria-label="Gallery images">
          {images.map((item, index) => (
            <button
              key={`${item.src}:${index}`}
              type="button"
              onClick={() => show(index)}
              aria-label={`Go to image ${index + 1}`}
              aria-current={safeActive === index ? 'true' : undefined}
              className="grid min-h-11 min-w-11 shrink-0 place-items-center"
            >
              <span className={`h-2 w-2 rounded-full ${safeActive === index ? 'bg-maroon' : 'bg-mute'}`} />
            </button>
          ))}
        </div>
        <p role="status" aria-live="polite" className="shrink-0 text-base tabular-nums">
          {safeActive + 1} / {images.length}
        </p>
      </div>
      {images.length > 1 ? (
        <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
          {images.map((item, index) => (
            <button
              key={`${item.src}:${index}`}
              type="button"
              onClick={() => show(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={safeActive === index ? 'true' : undefined}
              className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-transparent
                bg-paper aria-[current=true]:border-maroon"
            >
              <Picture data={item} sizes="64px" alt="" placeholder={!item.cutout}
                imgClassName={`h-full w-full ${item.cutout ? 'object-contain mix-blend-multiply' : 'object-cover'}`} />
            </button>
          ))}
        </div>
      ) : null}
      {lightbox ? createPortal(
        <dialog
          ref={dialog}
          data-lenis-prevent
          aria-modal="true"
          aria-label="Product image viewer"
          onCancel={() => setLightbox(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') move(-1);
            if (event.key === 'ArrowRight') move(1);
          }}
          className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col justify-between
            bg-ink/95 p-3 text-bone open:flex pt-[max(0.75rem,env(safe-area-inset-top))]
            pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <button type="button" onClick={() => setZoomed((value) => !value)}
              className="min-h-11 rounded-full bg-bone px-4 text-ink" aria-pressed={zoomed}>
              {zoomed ? 'Fit image' : 'Zoom image'}
            </button>
            <button type="button" onClick={() => setLightbox(false)}
              className="min-h-11 rounded-full bg-bone px-4 text-ink">
              Close
            </button>
          </div>
          <div className="my-3 flex min-h-0 flex-1 items-center justify-center overflow-auto">
            <Picture
              data={image}
              sizes="100vw"
              priority
              placeholder={false}
              className={zoomed ? 'block w-[180%] shrink-0' : 'block h-full w-full'}
              imgClassName="h-full w-full object-contain"
            />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2">
            <button type="button" onClick={() => move(-1)} disabled={images.length < 2}
              className="min-h-11 min-w-11 rounded-full bg-bone px-4 text-ink" aria-label="Previous image">
              Previous
            </button>
            <p role="status" className="text-base">{safeActive + 1} / {images.length}</p>
            <button type="button" onClick={() => move(1)} disabled={images.length < 2}
              className="min-h-11 min-w-11 rounded-full bg-bone px-4 text-ink" aria-label="Next image">
              Next
            </button>
          </div>
        </dialog>,
        document.body,
      ) : null}
    </div>
  );
}

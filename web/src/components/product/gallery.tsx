'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Picture } from '@/components/picture';
import type { ProductVariantView } from '@/lib/catalogue/types';

export function Gallery({ variant }: { variant: ProductVariantView }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const images = variant.images;
  const safeActive = Math.min(active, Math.max(0, images.length - 1));
  const move = useCallback((delta: number) => setActive((value) => (value + delta + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!lightbox) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    node?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false);
      if (event.key === 'ArrowLeft' && images.length) move(-1);
      if (event.key === 'ArrowRight' && images.length) move(1);
      if (event.key === 'Tab' && node) {
        const focusable = [...node.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus(); };
  }, [images.length, lightbox, move]);

  if (!images.length) return <div className="aspect-square rounded-[var(--radius-card)] bg-paper" />;
  const image = images[safeActive];
  const fit = image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover';
  return (
    <div>
      <div ref={viewport} onScroll={(event) => setActive(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))} className="flex snap-x snap-mandatory overflow-x-auto rounded-[var(--radius-card)] bg-paper lg:overflow-hidden">
        {images.map((item, index) => (
          <button key={item.src} type="button" onClick={() => { setActive(index); setLightbox(true); }} className="aspect-square w-full shrink-0 snap-center" aria-label={`Open image ${index + 1} of ${images.length}`}>
            <Picture data={item} sizes="(min-width: 1024px) 58vw, 100vw" priority={index === 0} placeholder={!item.cutout} imgClassName={`h-full w-full ${item.cutout ? 'object-contain mix-blend-multiply' : 'object-cover'}`} />
          </button>
        ))}
      </div>
      {images.length > 1 ? <div className="mt-3 flex gap-3 overflow-x-auto">{images.map((item, index) => (
        <button key={item.src} type="button" onClick={() => { setActive(index); viewport.current?.scrollTo({ left: viewport.current.clientWidth * index, behavior: 'smooth' }); }} aria-label={`Show image ${index + 1}`} aria-current={safeActive === index} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-paper ring-offset-2 aria-[current=true]:ring-2 aria-[current=true]:ring-maroon">
          <Picture data={item} sizes="80px" placeholder={!item.cutout} imgClassName={`h-full w-full ${item.cutout ? 'object-contain mix-blend-multiply' : 'object-cover'}`} />
        </button>
      ))}</div> : null}
      {lightbox ? (
        <div ref={dialog} role="dialog" aria-modal="true" aria-label="Product image viewer" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-4 outline-none">
          <button type="button" onClick={() => setLightbox(false)} className="absolute right-5 top-5 rounded-full bg-bone px-4 py-2 text-ink">Close</button>
          {images.length > 1 ? <button type="button" onClick={() => move(-1)} className="absolute left-3 rounded-full bg-bone px-4 py-3 text-ink" aria-label="Previous image">←</button> : null}
          <Picture data={image} sizes="100vw" priority placeholder={!image.cutout} className="flex max-h-[90vh] max-w-[90vw] items-center justify-center overflow-auto" imgClassName={`max-h-[90vh] max-w-full cursor-zoom-in scale-100 object-contain transition-transform active:scale-150 ${fit}`} />
          {images.length > 1 ? <button type="button" onClick={() => move(1)} className="absolute right-3 rounded-full bg-bone px-4 py-3 text-ink" aria-label="Next image">→</button> : null}
        </div>
      ) : null}
    </div>
  );
}

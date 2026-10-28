'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getLenis } from '@/components/site/smooth-scroll';
import { previewFilters } from '@/app/(site)/shop/actions';
import type { ShopResult } from '@/lib/catalogue/search';
import { clearFilters } from '../filter-state';
import { priceRangeError } from '../filter-state';
import { ShopFilters } from './shop-filters';
import type { CategoryOption } from './shop-filters';

type Props = {
  query: string;
  total: number;
  facets: ShopResult['facets'];
  categories: CategoryOption[];
  category?: string;
  hub?: string;
  onClose: () => void;
  onApply: (query: URLSearchParams) => void;
};

export function FilterSheet(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(props.query);
  const [preview, setPreview] = useState({ query: props.query, total: props.total, facets: props.facets });
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const priceError = priceRangeError(new URLSearchParams(draft));
  const pending = draft !== preview.query && !priceError;
  const { category, hub, onClose } = props;

  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    node?.showModal();
    getLenis()?.stop();
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener('change', onResize);
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      getLenis()?.start();
      desktop.removeEventListener('change', onResize);
      previous?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (priceError || (draft === props.query && retry === 0)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await previewFilters({ query: draft, category, hub });
        if (cancelled) return;
        if (result.ok) {
          setPreview({ query: draft, total: result.total, facets: result.facets });
          setError('');
        } else setError(result.error);
      } catch {
        if (!cancelled) setError('Could not count pieces. Please try again.');
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft, category, hub, props.query, retry, priceError]);

  const change = (query: URLSearchParams) => {
    setError('');
    setDraft(query.toString());
    if (query.toString() === props.query) {
      setPreview({ query: props.query, total: props.total, facets: props.facets });
    }
  };

  return createPortal(
    <dialog
      ref={dialog}
      data-lenis-prevent
      aria-modal="true"
      aria-labelledby="filter-sheet-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-ink/50"
    >
      <section
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-3xl bg-bone text-ink"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="filter-sheet-title" className="font-display text-2xl">Filters</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 px-3">Close filters</button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-3">
          <ShopFilters
            facets={preview.facets}
            categories={props.categories}
            showCategories={!category && !hub}
            query={draft}
            onChange={change}
            collapsible
          />
        </div>
        <footer
          data-sticky-bar
          className="shrink-0 border-t border-line bg-bone px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {priceError ? <p role="alert" className="mb-3 text-base">{priceError}</p> : null}
          {error ? (
            <div role="alert" className="mb-3 text-base">
              <p>{error}</p>
              <button type="button" className="min-h-11 underline" onClick={() => setRetry((value) => value + 1)}>
                Try again
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <button
              type="button"
              disabled={pending || Boolean(error) || Boolean(priceError)}
              onClick={() => props.onApply(new URLSearchParams(draft))}
              className="btn btn-primary min-h-11 disabled:opacity-60"
            >
              {pending ? 'Counting pieces…' : `Show ${preview.total} pieces`}
            </button>
            <button type="button" onClick={() => change(clearFilters(new URLSearchParams(draft)))}
              className="min-h-11 px-3 underline">
              Clear all
            </button>
          </div>
          <p role="status" className="sr-only">{pending ? 'Counting pieces' : `${preview.total} pieces`}</p>
        </footer>
      </section>
    </dialog>,
    document.body,
  );
}

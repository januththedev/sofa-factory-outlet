'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { getVariantsAction } from '@/app/(site)/cart/actions';
import { Picture } from '@/components/picture';
import { TLink } from '@/components/site/transition';
import { trackEvent } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/store';
import { CART_MAX_QUANTITY, type CartLine, type CartVariantOption, cartTotal } from '@/lib/cart/types';
import { cn } from '@/lib/cn';
import { formatLkr } from '@/lib/money';
import { CloseIcon, MinusIcon, PlusIcon } from './icons';

type Layout = 'drawer' | 'page';

/** Colours already fetched this visit, so reopening a picker (or opening another line of the same product) is instant. */
const variantCache = new Map<number, CartVariantOption[]>();

/**
 * Row keys that survive a colour change: the Nth line of a product keeps its key when its
 * colour is swapped, so the row (and the keyboard focus on it) stays put instead of remounting.
 */
function rowKeys(lines: CartLine[]): string[] {
  const seen = new Map<number, number>();
  return lines.map((line) => {
    const index = seen.get(line.productId) ?? 0;
    seen.set(line.productId, index + 1);
    return `${line.productId}.${index}`;
  });
}

type ListProps = {
  lines: CartLine[];
  layout: Layout;
  /** Called after a line is removed (its buttons vanish with it), so the caller can put focus somewhere sensible. */
  onRemoved?: () => void;
  /** Called when a product link is followed, e.g. to close the drawer. */
  onNavigate?: () => void;
};

export function CartLineList({ lines, layout, onRemoved, onNavigate }: ListProps) {
  const keys = rowKeys(lines);
  return (
    <ul className="divide-y divide-line border-y border-line">
      {lines.map((line, index) => (
        <CartLineItem key={keys[index]} line={line} layout={layout} onRemoved={onRemoved} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

function CartLineItem({ line, layout, onRemoved, onNavigate }: Omit<ListProps, 'lines'> & { line: CartLine }) {
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const replace = useCart((state) => state.replace);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  // The picker belongs to one colour of one product: it closes by itself once the line's key changes.
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [options, setOptions] = useState<CartVariantOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, startLoading] = useTransition();
  const pickerOpen = pickerFor === line.key;

  const roomy = layout === 'page';
  const href = `/product/${line.slug}/`;
  const fit = line.image?.cutout ? 'object-contain mix-blend-multiply' : 'object-cover';
  const label = `${line.name}, ${line.colourName}`;

  const togglePicker = () => {
    if (pickerOpen) {
      setPickerFor(null);
      return;
    }
    setPickerFor(line.key);
    const known = variantCache.get(line.productId);
    if (known) {
      setOptions(known);
      return;
    }
    setFailed(false);
    startLoading(async () => {
      try {
        const found = await getVariantsAction(line.productId);
        variantCache.set(line.productId, found);
        startLoading(() => setOptions(found));
      } catch {
        startLoading(() => setFailed(true));
      }
    });
  };

  const pick = (option: CartVariantOption) => {
    setPickerFor(null);
    toggle.current?.focus();
    if (option.id === line.variantId) return;
    replace(line.key, {
      productId: line.productId,
      variantId: option.id,
      slug: line.slug,
      name: line.name,
      colourName: option.colourName,
      hex: option.hex,
      image: option.image ?? line.image,
      priceMinor: line.priceMinor,
      ...(line.priceFrom ? { priceFrom: true } : {}),
    });
    setNotice(`${line.name} is now ${option.colourName}`);
  };

  const removeLine = () => {
    trackEvent('remove_from_cart', { productId: line.productId, variantId: line.variantId });
    remove(line.key);
    onRemoved?.();
  };

  return (
    <li className={cn('flex gap-4', roomy ? 'py-6 sm:gap-6 sm:py-8' : 'py-5')}>
      <div className={cn('relative shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-paper', roomy ? 'size-24 sm:size-36' : 'size-24')}>
        {line.image ? <Picture data={line.image} alt="" sizes={roomy ? '(min-width: 640px) 144px, 96px' : '96px'} className="block h-full w-full" imgClassName={`h-full w-full ${fit}`} /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <TLink href={href} onClick={onNavigate} className={cn('font-display leading-snug hover:underline', roomy ? 'text-xl sm:text-2xl' : 'text-lg')}>
            {line.name}
          </TLink>
          <button
            type="button"
            onClick={removeLine}
            aria-label={`Remove ${label} from your cart`}
            className="-mr-2 -mt-1.5 grid size-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-bone-2 hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <p className="mt-1 flex items-center gap-2 text-sm text-mute">
          <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: line.hex }} />
          {line.colourName}
        </p>
        {line.reason ? (
          <p className="mt-1.5 text-xs leading-snug text-cocoa">
            <span className="font-semibold">Goes with: </span>
            {line.reason}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div role="group" aria-label={`Quantity of ${label}`} className="inline-flex items-center rounded-full border border-line bg-paper">
            <StepButton label="Decrease quantity" disabled={line.quantity <= 1} onClick={() => setQuantity(line.key, line.quantity - 1)}>
              <MinusIcon />
            </StepButton>
            <span aria-live="polite" className="min-w-8 text-center text-sm font-medium tabular-nums">
              {line.quantity}
            </span>
            <StepButton label="Increase quantity" disabled={line.quantity >= CART_MAX_QUANTITY} onClick={() => setQuantity(line.key, line.quantity + 1)}>
              <PlusIcon />
            </StepButton>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums">
              {line.priceMinor === null ? 'Price on request' : `${line.priceFrom ? 'From ' : ''}${formatLkr(line.priceMinor * line.quantity)}`}
            </p>
            {line.priceMinor !== null && line.quantity > 1 ? <p className="text-xs text-mute tabular-nums">{formatLkr(line.priceMinor)} each</p> : null}
          </div>
        </div>

        <button
          ref={toggle}
          type="button"
          onClick={togglePicker}
          aria-expanded={pickerOpen}
          aria-controls={panelId}
          className="mt-3 text-sm font-medium text-maroon underline-offset-4 hover:underline"
        >
          Change colour
        </button>
        <div id={panelId} hidden={!pickerOpen} className="mt-3">
          {pickerOpen ? (
            <div role="group" aria-label={`Colours for ${line.name}`}>
              {failed ? (
                <p role="alert" className="text-sm text-bad">
                  Colours could not be loaded. Please try again.
                </p>
              ) : loading || !options ? (
                <p role="status" className="text-sm text-mute">
                  Loading colours…
                </p>
              ) : options.length < 2 ? (
                <p className="text-sm text-mute">No other colours are listed for this piece.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {options.map((option) => {
                    const current = option.id === line.variantId;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          aria-pressed={current}
                          onClick={() => pick(option)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                            current ? 'border-ink bg-ink text-bone' : 'border-line bg-paper text-ink hover:border-ink',
                          )}
                        >
                          <span aria-hidden className="h-4 w-4 shrink-0 rounded-full ring-1 ring-ink/20" style={{ backgroundColor: option.hex }} />
                          {option.colourName}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <span role="status" className="sr-only">
          {notice}
        </span>
      </div>
    </li>
  );
}

/** A stepper button that stays focusable at its limit (so focus is not lost when it can no longer be used). */
function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-bone-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-35 aria-disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Total in rupees when every line has a price; otherwise the plain-words version. Nothing for an empty cart. */
export function CartTotals({ lines }: { lines: CartLine[] }) {
  if (!lines.length) return null;
  const total = cartTotal(lines);
  if (total === null) return <p className="text-sm text-ink-2">Prices are confirmed at your visit.</p>;
  return (
    <div>
      <p className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-ink-2">{lines.some((line) => line.priceFrom) ? 'Total from' : 'Total'}</span>
        <span className="font-display text-2xl tabular-nums">{formatLkr(total)}</span>
      </p>
      <p className="mt-1 text-xs text-mute">Nothing is charged online. Final prices are confirmed at your visit.</p>
    </div>
  );
}

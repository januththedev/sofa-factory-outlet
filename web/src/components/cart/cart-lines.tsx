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

const variantCache = new Map<number, CartVariantOption[]>();

type ListProps = {
  lines: CartLine[];
  layout: 'drawer' | 'page';
  onRemoved?: (line: CartLine) => void;
  onNavigate?: () => void;
};

// Preserve a product row's identity when its colour changes.
function rowKeys(lines: CartLine[]): string[] {
  const seen = new Map<number, number>();
  return lines.map((line) => {
    const index = seen.get(line.productId) ?? 0;
    seen.set(line.productId, index + 1);
    return `${line.productId}.${index}`;
  });
}

export function CartLineList({ lines, layout, onRemoved, onNavigate }: ListProps) {
  const keys = rowKeys(lines);
  return (
    <ul className="divide-y divide-line border-y border-line">
      {lines.map((line, index) => (
        <CartLineItem
          key={keys[index]}
          line={line}
          layout={layout}
          onRemoved={onRemoved}
          onNavigate={onNavigate}
        />
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
  const latest = useRef(0);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [options, setOptions] = useState<CartVariantOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, startLoading] = useTransition();
  const pickerOpen = pickerFor === line.key;
  const roomy = layout === 'page';
  const fit = line.image?.cutout ? 'object-contain mix-blend-multiply' : 'object-cover';
  const label = `${line.name}, ${line.colourName}`;

  const togglePicker = (retry = false) => {
    if (pickerOpen && !retry) {
      setPickerFor(null);
      return;
    }
    setPickerFor(line.key);
    const known = variantCache.get(line.productId);
    if (known) {
      setOptions(known);
      return;
    }
    const request = ++latest.current;
    setFailed(false);
    startLoading(async () => {
      try {
        const found = await getVariantsAction(line.productId);
        variantCache.set(line.productId, found);
        if (latest.current === request) startLoading(() => setOptions(found));
      } catch {
        if (latest.current === request) startLoading(() => setFailed(true));
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

  return (
    <li className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 py-5 sm:gap-x-6">
      <div className="size-[72px] overflow-hidden rounded-xl bg-paper">
        {line.image ? (
          <Picture
            data={line.image}
            alt=""
            sizes="72px"
            className="block h-full w-full"
            imgClassName={`h-full w-full ${fit}`}
          />
        ) : <span aria-hidden className="block h-full" style={{ backgroundColor: line.hex }} />}
      </div>
      <div className="min-w-0">
        <TLink
          href={`/product/${line.slug}/`}
          onClick={onNavigate}
          className={cn(
            'line-clamp-2 min-h-11 break-words font-display leading-snug hover:underline',
            roomy ? 'text-xl sm:text-2xl' : 'text-lg',
          )}
        >
          {line.name}
        </TLink>
        <p className="mt-1 flex items-center gap-2 text-base text-mute">
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full ring-1 ring-ink/15"
            style={{ backgroundColor: line.hex }}
          />
          <span className="min-w-0 break-words">{line.colourName}</span>
        </p>
      </div>
      <div className="col-span-2 min-w-0 sm:col-start-2 sm:col-span-1">
        {line.reason ? <p className="mb-3 text-xs text-cocoa">Goes with: {line.reason}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label={`Quantity of ${label}`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper"
          >
            <StepButton
              label="Decrease quantity"
              disabled={line.quantity <= 1}
              onClick={() => setQuantity(line.key, line.quantity - 1)}
            >
              <MinusIcon />
            </StepButton>
            <span aria-live="polite" className="min-w-6 text-center text-base tabular-nums">{line.quantity}</span>
            <StepButton
              label="Increase quantity"
              disabled={line.quantity >= CART_MAX_QUANTITY}
              onClick={() => setQuantity(line.key, line.quantity + 1)}
            >
              <PlusIcon />
            </StepButton>
          </div>
          <p className="text-base tabular-nums">
            {line.priceMinor === null
              ? 'Price on request'
              : `${line.priceFrom ? 'From ' : ''}${formatLkr(line.priceMinor * line.quantity)}`}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            ref={toggle}
            type="button"
            onClick={() => togglePicker()}
            aria-expanded={pickerOpen}
            aria-controls={panelId}
            className="min-h-11 px-2 text-base font-medium text-maroon underline underline-offset-4"
          >
            Change colour
          </button>
          <button
            type="button"
            onClick={() => {
              trackEvent('remove_from_cart', { productId: line.productId, variantId: line.variantId });
              remove(line.key);
              onRemoved?.(line);
            }}
            aria-label={`Remove ${label} from your cart`}
            className="inline-flex min-h-11 items-center gap-2 px-2 text-base text-mute"
          >
            <CloseIcon />
            Remove
          </button>
        </div>
        <div id={panelId} hidden={!pickerOpen} className="mt-2">
          {pickerOpen ? (
            <div role="group" aria-label={`Colours for ${line.name}`}>
              {failed ? (
                <div role="alert">
                  <p>Colours could not be loaded.</p>
                  <button
                    type="button"
                    className="min-h-11 px-3 underline"
                    onClick={() => togglePicker(true)}
                  >
                    Try again
                  </button>
                </div>
              ) : loading || !options ? (
                <p role="status">Loading colours...</p>
              ) : options.length < 2 ? (
                <p>No other colours are listed for this piece.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        aria-pressed={option.id === line.variantId}
                        onClick={() => pick(option)}
                        className={cn(
                          'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-base',
                          option.id === line.variantId ? 'border-ink bg-ink text-bone' : 'border-line bg-paper',
                        )}
                      >
                        <span
                          aria-hidden
                          className="size-4 shrink-0 rounded-full ring-1 ring-ink/20"
                          style={{ backgroundColor: option.hex }}
                        />
                        {option.colourName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <span role="status" className="sr-only">{notice}</span>
      </div>
    </li>
  );
}

type StepButtonProps = {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function StepButton({ label, disabled, onClick, children }: StepButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className="grid size-11 place-items-center rounded-full text-ink hover:bg-bone-2 aria-disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export function CartTotals({ lines }: { lines: CartLine[] }) {
  if (!lines.length) return null;
  const total = cartTotal(lines);
  if (total === null) return <p className="text-base text-ink-2">Prices are confirmed at your visit.</p>;
  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base text-ink-2">{lines.some((line) => line.priceFrom) ? 'Total from' : 'Total'}</span>
        <span className="font-display text-2xl tabular-nums">{formatLkr(total)}</span>
      </p>
      <p className="mt-1 text-xs text-mute">Nothing is charged online. Final prices are confirmed at your visit.</p>
    </div>
  );
}

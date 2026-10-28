'use client';

import { useMemo } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { stepQuantity } from './builder-state';
import { useUnsavedWarning } from '@/components/admin/products/use-unsaved-warning';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { issueDraftAction } from '@/app/admin/(panel)/invoices/actions';
import { saveDraftAction } from '@/app/admin/(panel)/invoices/actions';
import { CustomerPicker } from '@/components/admin/invoices/customer-picker';
import { ProductPicker } from '@/components/admin/invoices/product-picker';
import type { CatalogueLine } from '@/components/admin/invoices/product-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import { discountInputToValue } from '@/lib/admin/invoices';
import { minorToRupeesInput } from '@/lib/admin/invoices';
import { rupeesToMinor } from '@/lib/admin/invoices';
import type { BuilderCustomer } from '@/lib/admin/invoices';
import type { BuilderDraftInput } from '@/lib/admin/invoices';
import type { BuilderLineInput } from '@/lib/admin/invoices';
import type { InvoiceView } from '@/lib/invoices/api';
import { computeTotals } from '@/lib/invoices/totals';
import type { InvoiceSettings } from '@/lib/settings/types';
import { formatLkr } from '@/lib/money';

type BuilderLine = {
  key: string;
  productId?: number;
  variantId?: number;
  description: string;
  colourName?: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  priceOnRequest: boolean;
};

function discountValueInput(invoice: InvoiceView | null): string {
  if (!invoice) return '';
  if (invoice.discount.type === 'percent') return String(invoice.discount.value / 100);
  return minorToRupeesInput(invoice.discount.value);
}

function initialLines(invoice: InvoiceView | null): BuilderLine[] {
  if (!invoice) return [];
  return invoice.lines.map((line, index) => ({
    key: `saved-${invoice.id}-${index}`,
    productId: line.productId,
    variantId: line.variantId,
    description: line.description,
    colourName: line.colourName,
    quantity: String(line.quantity),
    unitPrice: minorToRupeesInput(line.unitMinor),
    discount: line.discountMinor ? minorToRupeesInput(line.discountMinor) : '',
    priceOnRequest: Boolean(line.productId) && line.unitMinor === 0,
  }));
}

function quantityOf(line: BuilderLine): number {
  const value = Number(line.quantity);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function lineSubtotal(line: BuilderLine): number {
  return computeTotals({
    lines: [{
      description: line.description,
      quantity: quantityOf(line),
      unitMinor: rupeesToMinor(line.unitPrice) ?? 0,
      discountMinor: rupeesToMinor(line.discount) ?? 0,
    }],
  }).subtotalMinor;
}

function toLineInput(line: BuilderLine): BuilderLineInput {
  return {
    productId: line.productId,
    variantId: line.variantId,
    description: line.description.trim(),
    colourName: line.colourName?.trim() || undefined,
    quantity: quantityOf(line),
    unitMinor: rupeesToMinor(line.unitPrice) ?? 0,
    discountMinor: rupeesToMinor(line.discount) ?? 0,
  };
}

export function InvoiceBuilder({
  invoice,
  type,
  settings,
}: {
  invoice: InvoiceView | null;
  type: 'invoice' | 'quotation';
  settings: InvoiceSettings;
}) {
  const router = useRouter();
  const counter = useRef(0);
  const [draftId, setDraftId] = useState<number | undefined>(invoice?.id);
  const [customer, setCustomer] = useState<BuilderCustomer | null>(invoice?.customer ?? null);
  const [source, setSource] = useState<'website' | 'walk-in'>(invoice?.source ?? 'walk-in');
  const [lines, setLines] = useState<BuilderLine[]>(() => initialLines(invoice));
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(invoice?.discount.type ?? 'amount');
  const [discountValue, setDiscountValue] = useState(() => discountValueInput(invoice));
  const [delivery, setDelivery] = useState(() => (invoice ? minorToRupeesInput(invoice.deliveryMinor) : ''));
  const [advance, setAdvance] = useState(() => (invoice ? minorToRupeesInput(invoice.paidMinor) : ''));
  const [deliveryDate, setDeliveryDate] = useState(invoice?.deliveryDate ?? '');
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [terms, setTerms] = useState(invoice?.terms ?? settings.terms);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const booking = invoice?.booking ?? null;
  const kindLabel = type === 'quotation' ? 'quotation' : 'invoice';

  useUnsavedWarning(dirty);

  const totals = useMemo(() => computeTotals({
    lines: lines.map((line) => ({
      description: line.description,
      quantity: quantityOf(line),
      unitMinor: rupeesToMinor(line.unitPrice) ?? 0,
      discountMinor: rupeesToMinor(line.discount) ?? 0,
    })),
    discount: { type: discountType, value: discountInputToValue(discountType, discountValue) },
    deliveryMinor: rupeesToMinor(delivery) ?? 0,
    taxRateBp: settings.taxEnabled ? settings.taxRateBp : 0,
    paidMinor: rupeesToMinor(advance) ?? 0,
  }), [lines, discountType, discountValue, delivery, advance, settings.taxEnabled, settings.taxRateBp]);

  function markDirty() {
    setDirty(true);
    setMessage(null);
  }

  function nextKey(): string {
    counter.current += 1;
    return `added-${counter.current}`;
  }

  function addCatalogueLine(line: CatalogueLine) {
    const key = nextKey();
    setLines((current) => [...current, {
      key,
      productId: line.productId,
      variantId: line.variantId,
      description: line.description,
      colourName: line.colourName,
      quantity: '1',
      unitPrice: line.unitPrice,
      discount: '',
      priceOnRequest: line.priceOnRequest,
    }]);
    markDirty();
  }

  function addCustomLine() {
    const key = nextKey();
    setLines((current) => [...current, {
      key,
      description: '',
      quantity: '1',
      unitPrice: '',
      discount: '',
      priceOnRequest: false,
    }]);
    markDirty();
  }

  function updateLine(key: string, patch: Partial<BuilderLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    markDirty();
  }

  function removeLine(key: string) {
    if (!window.confirm('Remove this line from the invoice?')) return;
    setLines((current) => current.filter((line) => line.key !== key));
    markDirty();
  }

  function payload(): { ok: true; value: BuilderDraftInput } | { ok: false; error: string } {
    if (!customer) return { ok: false, error: 'Choose or add a customer first.' };
    const cleaned = lines.filter((line) => line.description.trim());
    if (!cleaned.length) return { ok: false, error: 'Add at least one line item.' };
    if (cleaned.some((line) => quantityOf(line) < 1)) {
      return { ok: false, error: 'Every line needs a quantity of at least one.' };
    }
    return {
      ok: true,
      value: {
        id: draftId,
        type,
        customerId: customer.id,
        bookingId: booking?.id,
        source,
        lines: cleaned.map(toLineInput),
        discount: { type: discountType, value: discountInputToValue(discountType, discountValue) },
        deliveryMinor: rupeesToMinor(delivery) ?? 0,
        advanceMinor: rupeesToMinor(advance) ?? 0,
        taxRateBp: settings.taxEnabled ? settings.taxRateBp : 0,
        deliveryDate: deliveryDate || undefined,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
      },
    };
  }

  async function save(issue: boolean) {
    if (saving) return;
    setMessage(null);
    const built = payload();
    if (!built.ok) {
      setMessage({ tone: 'bad', text: built.error });
      return;
    }
    setSaving(true);
    try {
      const response = issue ? await issueDraftAction(built.value) : await saveDraftAction(built.value);
      if (!response.ok) {
        setMessage({ tone: 'bad', text: response.error });
        return;
      }
      setDirty(false);
      if (issue) {
        router.push(`/admin/invoices/${response.invoiceId}/`);
        return;
      }
      setDraftId(response.invoiceId);
      setMessage({ tone: 'ok', text: 'Draft saved.' });
      if (!draftId) router.replace(`/admin/invoices/${response.invoiceId}/edit/`);
    } catch (error) {
      console.error('[invoices] builder save failed:', error);
      setMessage({ tone: 'bad', text: 'We could not save this invoice. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6 pb-36">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={type === 'quotation' ? 'neutral' : 'maroon'}>
          {type === 'quotation' ? 'Quotation' : 'Invoice'}
        </Badge>
        {booking ? (
          <Link
            href={`/admin/bookings/${booking.id}/`}
            className="text-base sm:text-sm text-maroon underline-offset-4 hover:underline"
          >
            From booking {booking.reference}
          </Link>
        ) : <span className="text-base sm:text-sm text-mute">Walk-in or website sale</span>}
        <span className="text-base sm:text-sm text-mute">{draftId ? 'Editing a draft' : 'New draft'}</span>
      </div>

      <section
        aria-labelledby="customer-heading"
        className="rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6"
      >
        <h2 id="customer-heading" className="font-display text-2xl">1. Customer</h2>
        <p
          className="mt-1 text-base sm:text-sm text-mute">
          Search the existing book, or add the person at the counter.
        </p>
        <div className="mt-4">
          <CustomerPicker
            selected={customer}
            onSelect={(next) => {
              setCustomer(next);
              markDirty();
            }}
            onClear={() => {
              setCustomer(null);
              markDirty();
            }}
          />
        </div>
        <Field label="Sale source" htmlFor="sale-source" className="mt-4 max-w-xs">
          <Select
            id="sale-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value as 'website' | 'walk-in');
              markDirty();
            }}
          >
            <option value="walk-in">Walk-in</option>
            <option value="website">Website</option>
          </Select>
        </Field>
      </section>

      <section
        aria-labelledby="lines-heading"
        className="rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6"
      >
        <h2 id="lines-heading" className="font-display text-2xl">2. Line items</h2>
        <p
          className="mt-1 text-base sm:text-sm text-mute">
          Choose a colour variant, then set the quantity and price.
        </p>
        <div className="mt-4">
          <ProductPicker onAdd={addCatalogueLine} />
        </div>
        <ul className="mt-5 space-y-3">
          {lines.map((line, index) => (
            <li key={line.key} className="rounded-xl border border-line bg-bone/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-mute">
                  Line {index + 1}
                  {line.priceOnRequest ? <Badge tone="warn" className="ml-2">Price on request</Badge> : null}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(line.key)}
                  aria-label={`Remove ${line.description || `line ${index + 1}`}`}
                >
                  Remove
                </Button>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-12">
                <Field label="Description" htmlFor={`line-description-${line.key}`} className="xl:col-span-6">
                  <Input
                    id={`line-description-${line.key}`}
                    value={line.description}
                    onChange={(event) => updateLine(line.key, { description: event.target.value })}
                    placeholder="Delivery to Kandy"
                  />
                </Field>
                <Field label="Colour" htmlFor={`line-colour-${line.key}`} className="xl:col-span-3">
                  <Input
                    id={`line-colour-${line.key}`}
                    value={line.colourName ?? ''}
                    onChange={(event) => updateLine(line.key, { colourName: event.target.value })}
                  />
                </Field>
                <Field label="Qty" htmlFor={`line-quantity-${line.key}`} className="xl:col-span-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" aria-label={`Decrease quantity for line ${index + 1}`}
                      disabled={quantityOf(line) <= 1 || saving}
                      onClick={() => updateLine(line.key, { quantity: stepQuantity(line.quantity, -1) })}>
                      −
                    </Button>
                    <Input
                      id={`line-quantity-${line.key}`}
                      className="min-w-0 text-center"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                    />
                    <Button variant="ghost" aria-label={`Increase quantity for line ${index + 1}`}
                      disabled={saving}
                      onClick={() => updateLine(line.key, { quantity: stepQuantity(line.quantity, 1) })}>
                      +
                    </Button>
                  </div>
                </Field>
                <Field label="Unit price (Rs.)" htmlFor={`line-price-${line.key}`} className="xl:col-span-3">
                  <Input
                    id={`line-price-${line.key}`}
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                  />
                </Field>
                <Field label="Line discount (Rs.)" htmlFor={`line-discount-${line.key}`} className="xl:col-span-3">
                  <Input
                    id={`line-discount-${line.key}`}
                    inputMode="decimal"
                    value={line.discount}
                    onChange={(event) => updateLine(line.key, { discount: event.target.value })}
                  />
                </Field>
                <div className="xl:col-span-1 xl:self-end xl:text-right">
                  <p className="text-xs text-mute">Total</p>
                  <p className="font-semibold tabular-nums">{formatLkr(lineSubtotal(line), { decimals: true })}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {lines.length === 0 ? (
          <p
            className="mt-4 text-base sm:text-sm text-mute">
            No lines yet. Search the catalogue or add a custom line.
          </p>
        ) : null}
        <Button variant="subtle" size="sm" className="mt-4" onClick={addCustomLine}>Add custom line</Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="charges-heading"
          className="rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6"
        >
          <h2 id="charges-heading" className="font-display text-2xl">3. Charges</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Discount type" htmlFor="discount-type">
              <Select
                id="discount-type"
                value={discountType}
                onChange={(event) => {
                  setDiscountType(event.target.value as 'amount' | 'percent');
                  markDirty();
                }}
              >
                <option value="amount">Amount (Rs.)</option>
                <option value="percent">Percentage (%)</option>
              </Select>
            </Field>
            <Field
              label={discountType === 'percent' ? 'Discount (%)' : 'Discount (Rs.)'}
              htmlFor="discount-value"
            >
              <Input
                id="discount-value"
                inputMode="decimal"
                value={discountValue}
                onChange={(event) => {
                  setDiscountValue(event.target.value);
                  markDirty();
                }}
              />
            </Field>
            <Field label="Delivery charge (Rs.)" htmlFor="delivery-charge">
              <Input
                id="delivery-charge"
                inputMode="decimal"
                value={delivery}
                onChange={(event) => {
                  setDelivery(event.target.value);
                  markDirty();
                }}
              />
            </Field>
            <Field
              label="Advance paid (Rs.)"
              htmlFor="advance-paid"
              hint="Shown in the totals; record payments on the issued invoice."
            >
              <Input
                id="advance-paid"
                inputMode="decimal"
                value={advance}
                onChange={(event) => {
                  setAdvance(event.target.value);
                  markDirty();
                }}
              />
            </Field>
          </div>
          {settings.taxEnabled ? (
            <p className="mt-4 text-base sm:text-sm text-ink-2">
              {settings.taxLabel} ({settings.taxRateBp / 100}%) is applied to the taxable total.
            </p>
          ) : <p className="mt-4 text-base sm:text-sm text-mute">Tax is off in invoice settings.</p>}
        </section>

        <section
          aria-labelledby="totals-heading"
          className="rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6"
        >
          <h2 id="totals-heading" className="font-display text-2xl">Totals</h2>
          <dl className="mt-4 space-y-2 text-base sm:text-sm">
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatLkr(totals.subtotalMinor, { decimals: true })}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Discount</dt>
              <dd className="tabular-nums">− {formatLkr(totals.discountMinor, { decimals: true })}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Delivery</dt>
              <dd className="tabular-nums">{formatLkr(totals.deliveryMinor, { decimals: true })}</dd>
            </div>
            {settings.taxEnabled ? (
              <div className="flex justify-between gap-4">
                <dt>{settings.taxLabel}</dt>
                <dd className="tabular-nums">{formatLkr(totals.taxMinor, { decimals: true })}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{formatLkr(totals.totalMinor, { decimals: true })}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Advance paid</dt>
              <dd className="tabular-nums">{formatLkr(totals.paidMinor, { decimals: true })}</dd>
            </div>
            <div className="flex justify-between gap-4 font-semibold text-warn">
              <dt>Balance due</dt>
              <dd className="tabular-nums">{formatLkr(totals.balanceMinor, { decimals: true })}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section
        aria-labelledby="notes-heading"
        className="rounded-[var(--radius-card)] border border-line bg-paper p-4 sm:p-6"
      >
        <h2 id="notes-heading" className="font-display text-2xl">4. Notes and terms</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Delivery date" htmlFor="delivery-date">
            <Input
              id="delivery-date"
              type="date"
              value={deliveryDate}
              onChange={(event) => {
                setDeliveryDate(event.target.value);
                markDirty();
              }}
            />
          </Field>
          <Field label="Notes" htmlFor="invoice-notes" className="sm:row-span-2">
            <Textarea
              id="invoice-notes"
              rows={4}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                markDirty();
              }}
              placeholder="Anything the customer should see on the invoice."
            />
          </Field>
          <Field label="Terms" htmlFor="invoice-terms">
            <Textarea
              id="invoice-terms"
              rows={4}
              value={terms}
              onChange={(event) => {
                setTerms(event.target.value);
                markDirty();
              }}
            />
          </Field>
        </div>
      </section>

      <div
        data-sticky-bar
        className={
          'sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 '
          + 'rounded-xl border border-line bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm'
        }
      >
        <div className="basis-full text-base font-semibold">
          Total {formatLkr(totals.totalMinor, { decimals: true })}
          <span className="ml-3 font-normal">Due {formatLkr(totals.balanceMinor, { decimals: true })}</span>
        </div>
        <div aria-live="polite" className="text-base sm:text-sm">
          {message ? (
            <span className={message.tone === 'ok' ? 'text-good' : 'text-bad'}>{message.text}</span>
          ) : (
            <span className="text-mute">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => save(false)} disabled={saving}>Save draft</Button>
          <Button onClick={() => save(true)} disabled={saving}>
            {saving ? 'Saving…' : `Issue ${kindLabel}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { MessageCircle } from 'lucide-react';
import { Phone } from 'lucide-react';
import { BookingLinks } from '@/components/admin/bookings/history';
import { InvoiceLinks } from '@/components/admin/bookings/history';
import { ItemThumb } from '@/components/admin/bookings/item-thumb';
import { itemAlt } from '@/components/admin/bookings/item-thumb';
import { Transcript } from '@/components/admin/bookings/transcript';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { formatColomboDateTime } from '@/lib/admin/bookings';
import { PREFERRED_CONTACT_LABELS } from '@/lib/admin/bookings';
import { type BookingDetail } from '@/lib/admin/bookings';
import { type ItemView } from '@/lib/admin/bookings';
import { formatLkr } from '@/lib/money';

const HEX = /^#[0-9a-f]{3,8}$/i;

/** A small round colour sample; draws nothing when the stored value is not a hex colour. */
export function Swatch({ hex }: { hex: string | null }) {
  if (!hex || !HEX.test(hex)) return null;
  return (
    <span
      aria-hidden
      data-swatch
      className="inline-block size-4 shrink-0 rounded-full border border-ink/20"
      style={{ backgroundColor: hex }}
    />
  );
}

export function CustomerCard({ detail, whatsappHref }: { detail: BookingDetail; whatsappHref: string | null }) {
  const { customer, visit, customerNotes } = detail.sheet;
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap">
        <CardTitle>Customer</CardTitle>
        <Link
          href={`/admin/customers/${detail.customerId}/`}
          className={
            'inline-flex min-h-11 min-w-11 items-center text-base font-semibold text-maroon ' +
            'hover:underline sm:text-sm'
          }
        >
          Customer record
        </Link>
      </CardHeader>
      <CardBody className="space-y-5">
        <p className="font-display text-2xl leading-tight">{customer.name}</p>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${customer.phone}`} className={buttonStyles({ variant: 'primary', size: 'sm' })}>
            <Phone className="size-4" aria-hidden />
            Call {customer.phoneLabel}
          </a>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: 'ghost', size: 'sm' })}
            >
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
        {whatsappHref ? null : (
          <p className="text-base text-mute sm:text-sm">No WhatsApp number is saved for this customer.</p>
        )}
        <dl className="grid gap-x-6 gap-y-4 text-base sm:text-sm sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <dt className="eyebrow">Email</dt>
            <dd className="mt-1 break-all">
              {customer.email ? (
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex min-h-11 items-center gap-1.5 hover:text-maroon hover:underline"
                >
                  <Mail className="size-4 shrink-0 text-mute" aria-hidden />
                  {customer.email}
                </a>
              ) : (
                <span className="text-mute">Not given</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">City</dt>
            <dd className="mt-1">{customer.city ?? <span className="text-mute">Not given</span>}</dd>
          </div>
          <div>
            <dt className="eyebrow">Prefers to be contacted by</dt>
            <dd className="mt-1">{PREFERRED_CONTACT_LABELS[visit.preferredContact]}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <dt className="eyebrow">Their notes</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words">
              {customerNotes ?? <span className="text-mute">They left no notes.</span>}
            </dd>
          </div>
          {detail.customerRecordNotes ? (
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="eyebrow">Notes on their record</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">{detail.customerRecordNotes}</dd>
            </div>
          ) : null}
        </dl>
      </CardBody>
    </Card>
  );
}

function ItemPrice({ item }: { item: ItemView }) {
  if (item.priceMinor === null || item.lineMinor === null) return <span className="text-mute">Price on request</span>;
  return (
    <>
      <span className="block font-medium">{formatLkr(item.lineMinor)}</span>
      {item.quantity > 1 ? <span className="block text-xs text-mute">{formatLkr(item.priceMinor)} each</span> : null}
    </>
  );
}

export function ProductsCard({
  items,
  pieces,
  totalMinor,
}: {
  items: ItemView[];
  pieces: number;
  totalMinor: number | null;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap">
        <CardTitle>Products selected</CardTitle>
        <span className="text-base sm:text-sm text-mute">
          {pieces} {pieces === 1 ? 'piece' : 'pieces'}
        </span>
      </CardHeader>
      {items.length === 0 ? (
        <CardBody>
          <p className="text-base sm:text-sm text-mute">No pieces were chosen. They booked a visit without a cart.</p>
        </CardBody>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 p-4 sm:flex sm:gap-4">
                <ItemThumb image={item.image} alt={itemAlt(item)} className="size-16 sm:size-20" />
                <div className="min-w-0 flex-1">
                  {item.productId !== null && item.slug ? (
                    <Link
                      href={`/product/${item.slug}/`}
                      className={
                        'inline-flex min-h-11 min-w-11 items-center break-words font-medium text-maroon ' +
                        'hover:underline'
                      }
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.name}</span>
                  )}
                  <p className="mt-1.5 flex items-center gap-2 text-base sm:text-sm text-ink-2">
                    <Swatch hex={item.hex} />
                    {item.colourName ?? 'Colour not chosen'}
                  </p>
                  <p className="mt-1 text-base sm:text-sm text-mute">Quantity {item.quantity}</p>
                </div>
                <div className="col-start-2 min-w-0 text-base sm:shrink-0 sm:text-right sm:text-sm">
                  <ItemPrice item={item} />
                </div>
              </li>
            ))}
          </ul>
          <div
            className={
              'flex flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-3 ' +
              'text-base sm:text-sm'
            }
          >
            <span className="font-semibold">Total</span>
            {totalMinor === null ? (
              <span className="text-mute">Not shown: some prices are on request</span>
            ) : (
              <span className="font-semibold">{formatLkr(totalMinor)}</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

export function VisitCard({ detail }: { detail: BookingDetail }) {
  const { visit } = detail.sheet;
  const tags = Object.entries(detail.utm ?? {});
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap">
        <CardTitle>Visit</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <dl className="grid gap-x-6 gap-y-4 text-base sm:text-sm sm:grid-cols-2">
          <div>
            <dt className="eyebrow">Date</dt>
            <dd className="mt-1 font-medium">{visit.dateLabel}</dd>
          </div>
          <div>
            <dt className="eyebrow">Time slot</dt>
            <dd className="mt-1 font-medium">{visit.slotLabel}</dd>
          </div>
          <div>
            <dt className="eyebrow">Booked</dt>
            <dd className="mt-1">{formatColomboDateTime(detail.createdAt)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Found us via</dt>
            <dd className="mt-1">
              {detail.source.origin}
              {detail.source.detail ? <span className="block text-mute">{detail.source.detail}</span> : null}
            </dd>
          </div>
          {detail.referrer ? (
            <div className="sm:col-span-2">
              <dt className="eyebrow">Referrer</dt>
              <dd className="mt-1 break-all">{detail.referrer}</dd>
            </div>
          ) : null}
          {tags.length > 0 ? (
            <div className="sm:col-span-2">
              <dt className="eyebrow">Campaign tags</dt>
              <dd className="mt-1">
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {tags.map(([key, value]) => (
                    <li key={key} className="break-all">
                      <span className="text-mute">{key}</span> {value}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
        {detail.conversationId !== null ? <Transcript lines={detail.chat} /> : null}
      </CardBody>
    </Card>
  );
}

export function HistoryCard({ detail }: { detail: BookingDetail }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap">
        <CardTitle>Past bookings and invoices</CardTitle>
      </CardHeader>
      <CardBody className="space-y-6">
        <section aria-labelledby="past-bookings">
          <h3 id="past-bookings" className="eyebrow mb-1">
            Other bookings
          </h3>
          <BookingLinks bookings={detail.pastBookings} empty="This is their only booking." />
        </section>
        <section aria-labelledby="past-invoices">
          <h3 id="past-invoices" className="eyebrow mb-1">
            Invoices
          </h3>
          <InvoiceLinks invoices={detail.invoices} empty="No invoices yet." />
        </section>
      </CardBody>
    </Card>
  );
}

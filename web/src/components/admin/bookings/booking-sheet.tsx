import { Swatch } from '@/components/admin/bookings/detail-cards';
import { ItemThumb, itemAlt } from '@/components/admin/bookings/item-thumb';
import {
  PREFERRED_CONTACT_LABELS,
  STATUS_LABELS,
  type BookingSheet as BookingSheetData,
} from '@/lib/admin/bookings';
import { formatLkr } from '@/lib/money';

/**
 * Print rules for the booking sheet: A4, and everything around the sheet (the admin sidebar and
 * top bar, which sit outside this page) hidden. They live in a <style> tag so the sheet prints
 * the same wherever it is shown.
 */
export const PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
@media print {
  html, body { background: #fff !important; }
  .skip-link, aside, header, [data-print="hide"] { display: none !important; }
  .lg\\:grid { display: block !important; }
  main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  #booking-sheet { width: 100% !important; max-width: none !important; border: 0 !important; padding: 0 !important; }
  #booking-sheet [data-swatch] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #booking-sheet h2, #booking-sheet h3 { break-after: avoid; }
  #booking-sheet li, #booking-sheet tr, #booking-sheet [data-keep] { break-inside: avoid; }
}
`;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-keep>
      <h2 className="eyebrow border-b border-ink/30 pb-1">{title}</h2>
      <div className="mt-2 space-y-1 text-sm">{children}</div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex gap-2">
      <span className="w-24 shrink-0 text-mute">{label}</span>
      <span className="min-w-0 break-words font-medium">{value}</span>
    </p>
  );
}

/** One A4 page for showroom staff: who is coming, when, which pieces, notes and a signature line. */
export function BookingSheet({ sheet, businessName }: { sheet: BookingSheetData; businessName: string }) {
  const { customer, visit } = sheet;
  return (
    <article
      id="booking-sheet"
      aria-labelledby="sheet-title"
      className={
        'mx-auto w-full max-w-[210mm] rounded-[var(--radius-card)] border border-line bg-white p-6 text-ink ' +
        'sm:p-10'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt={businessName} width={2111} height={503} className="h-10 w-auto" />
        <div className="text-right">
          <h1 id="sheet-title" className="font-display text-2xl leading-tight">
            Showroom visit sheet
          </h1>
          <p className="text-lg font-semibold">{sheet.reference}</p>
          <p className="text-sm text-mute">Status: {STATUS_LABELS[sheet.status]}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Block title="Customer">
          <Line label="Name" value={customer.name} />
          <Line label="Phone" value={customer.phoneLabel} />
          {customer.whatsapp ? <Line label="WhatsApp" value={customer.whatsapp} /> : null}
          {customer.email ? <Line label="Email" value={customer.email} /> : null}
          {customer.city ? <Line label="City" value={customer.city} /> : null}
          <Line label="Contact by" value={PREFERRED_CONTACT_LABELS[visit.preferredContact]} />
        </Block>
        <Block title="Visit">
          <Line label="Date" value={visit.dateLabel} />
          <Line label="Time slot" value={visit.slotLabel} />
          <Line label="Booked" value={sheet.bookedOn} />
          <Line label="Pieces" value={sheet.pieces} />
        </Block>
      </div>

      <section className="mt-6" aria-labelledby="sheet-products">
        <h2 id="sheet-products" className="eyebrow border-b border-ink/30 pb-1">
          Products
        </h2>
        {sheet.items.length === 0 ? (
          <p className="mt-2 text-sm text-mute">No pieces were chosen before the visit.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-mute">
                <th scope="col" className="w-16 py-1.5 pr-3 font-semibold">
                  <span className="sr-only">Photo</span>
                </th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Product
                </th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Colour
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                  Qty
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold">
                  Price
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/15">
              {sheet.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-3">
                    <ItemThumb image={item.image} alt={itemAlt(item)} className="size-14" />
                  </td>
                  <td className="py-2 pr-3 font-medium">{item.name}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <Swatch hex={item.hex} />
                      {item.colourName ?? 'Not chosen'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">
                    {item.lineMinor === null ? 'On request' : formatLkr(item.lineMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink/30 font-semibold">
                <td colSpan={3} className="py-2">
                  Total
                </td>
                <td className="py-2 pr-3 text-right">{sheet.pieces}</td>
                <td className="py-2 text-right">
                  {sheet.totalMinor === null ? 'On request' : formatLkr(sheet.totalMinor)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Block title="Customer's notes">
          <p className="whitespace-pre-wrap break-words">{sheet.customerNotes ?? 'None.'}</p>
        </Block>
        <Block title="Staff notes">
          <p className="whitespace-pre-wrap break-words">{sheet.staffNotes ?? 'None.'}</p>
        </Block>
      </div>

      <section className="mt-6" data-keep aria-labelledby="sheet-visit-notes">
        <h2 id="sheet-visit-notes" className="eyebrow">
          Notes from the visit
        </h2>
        <div aria-hidden className="mt-1">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-8 border-b border-ink/30" />
          ))}
        </div>
      </section>

      <div data-keep className="mt-10 grid gap-8 text-sm sm:grid-cols-2">
        <div>
          <div className="h-10 border-b border-ink" />
          <p className="mt-1 text-mute">Customer signature and date</p>
        </div>
        <div>
          <div className="h-10 border-b border-ink" />
          <p className="mt-1 text-mute">Staff signature and date</p>
        </div>
      </div>
    </article>
  );
}

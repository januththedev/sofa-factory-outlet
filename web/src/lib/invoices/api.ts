import type { InvoiceStatus } from '../db/schema/types';

// CONTRACT STUB. Owner: "invoices-core" agent. Keep these exports and signatures.
// The admin UI ("invoices-ui") and "Convert to invoice" on bookings are written against this file.
// All money is integer minor units (cents) of LKR; percentages are basis points (1250 = 12.5%).

export type LineInput = {
  productId?: number;
  variantId?: number;
  description: string;
  colourName?: string;
  quantity: number;
  unitMinor: number;
  /** discount on this line, minor units */
  discountMinor?: number;
};

export type TotalsInput = {
  lines: LineInput[];
  discount?: { type: 'amount' | 'percent'; value: number };
  deliveryMinor?: number;
  taxRateBp?: number;
  paidMinor?: number;
};

export type Totals = {
  subtotalMinor: number;
  discountMinor: number;
  deliveryMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
};

/** Pure function, no database: line totals, discount, delivery, tax, advance paid and balance. Integer arithmetic only; never negative totals. */

/** "Convert to invoice" on a booking: a draft invoice with the customer and the booking's cart lines (colours included), source 'website'. */

export type InvoiceDraftInput = {
  /** present = update that draft or quotation; issued invoices are immutable */
  id?: number;
  type: 'invoice' | 'quotation';
  customerId: number;
  bookingId?: number;
  source: 'website' | 'walk-in';
  lines: LineInput[];
  discount?: { type: 'amount' | 'percent'; value: number };
  deliveryMinor?: number;
  taxRateBp?: number;
  /** YYYY-MM-DD */
  deliveryDate?: string;
  notes?: string;
  terms?: string;
};


/**
 * Issues a draft inside one transaction: takes the next number from invoice_counters
 * (row-locked, so numbers never repeat) as SFO-2026-0001, or SFO-Q-2026-0001 for quotations,
 * and sets status 'issued'.
 */

export type PaymentInput = { invoiceId: number; amountMinor: number; method: 'cash' | 'bank_transfer' | 'card'; paidOn: string; reference?: string; note?: string };

/** Records a payment and updates paid/balance and status (issued → partially_paid → paid). Rejects overpayment. */

/** Cancelled invoices are kept, never deleted. */

/** A new draft invoice copied from an accepted quotation; the quotation keeps its number and links to it. */

export type InvoiceListFilter = {
  status?: InvoiceStatus;
  type?: 'invoice' | 'quotation';
  source?: 'website' | 'walk-in';
  /** matches number, customer name or phone */
  q?: string;
  /** YYYY-MM-DD, inclusive */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type InvoiceRow = {
  id: number;
  number: string | null;
  type: 'invoice' | 'quotation';
  status: InvoiceStatus;
  source: 'website' | 'walk-in';
  customerName: string;
  customerPhone: string;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  issuedAt: string | null;
  createdAt: string;
};


export type InvoiceView = InvoiceRow & {
  customer: { id: number; name: string; phone: string; whatsapp: string | null; email: string | null; city: string | null; address: string | null };
  booking: { id: number; reference: string } | null;
  lines: Array<LineInput & { id: number; lineMinor: number }>;
  discount: { type: 'amount' | 'percent'; value: number };
  discountMinor: number;
  subtotalMinor: number;
  deliveryMinor: number;
  taxRateBp: number;
  taxMinor: number;
  deliveryDate: string | null;
  notes: string | null;
  terms: string | null;
  payments: Array<{ id: number; amountMinor: number; method: string; paidOn: string; reference: string | null; note: string | null }>;
  convertedFromId: number | null;
};


export type RevenueReport = {
  months: Array<{ month: string; invoicedMinor: number; paidMinor: number; websiteMinor: number; walkInMinor: number }>;
  outstanding: Array<{ invoiceId: number; number: string; customerName: string; balanceMinor: number; issuedAt: string }>;
};


/** A4 PDF via @react-pdf/renderer: logo, business and bank details, customer, items, totals, delivery date, warranty and terms, signature lines. */

/** Signed (jose, CRON_SECRET/AUTH_SECRET based) private link to the PDF, valid 30 days: "/api/invoices/<id>/pdf/?t=<token>". */
export { computeTotals } from './totals';
export {
  cancelInvoice,
  convertQuotationToInvoice,
  createInvoiceFromBooking,
  getInvoice,
  issueInvoice,
  listInvoices,
  recordPayment,
  revenueReport,
  saveInvoiceDraft,
} from './service';
export { renderInvoicePdf } from './pdf';
export { createShareLink, verifyShareToken } from './share';

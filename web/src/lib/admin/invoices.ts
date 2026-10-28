import type { InvoiceRow } from '@/lib/invoices/api';
import type { InvoiceStatus } from '@/lib/db/schema/types';
import { formatLkr } from '@/lib/money';
import { normaliseLkPhone, whatsappDigitsFor } from '@/lib/phone';

export type BuilderCustomer = {
  id: number;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
};

export type CustomerOption = BuilderCustomer;

export type ProductVariantOption = {
  id: number;
  colourName: string;
  hex: string;
  inStock: boolean;
};

export type ProductOption = {
  id: number;
  name: string;
  priceMinor: number;
  priceOnRequest: boolean;
  variants: ProductVariantOption[];
};

export type BuilderLineInput = {
  productId?: number;
  variantId?: number;
  description: string;
  colourName?: string;
  quantity: number;
  unitMinor: number;
  discountMinor?: number;
};

export type BuilderDraftInput = {
  id?: number;
  type: 'invoice' | 'quotation';
  customerId: number;
  bookingId?: number;
  source: 'website' | 'walk-in';
  lines: BuilderLineInput[];
  discount: { type: 'amount' | 'percent'; value: number };
  deliveryMinor: number;
  advanceMinor: number;
  taxRateBp: number;
  deliveryDate?: string;
  notes?: string;
  terms?: string;
};

export type CsvValue = string | number | boolean | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvValue;
};

export type BadgeTone = 'neutral' | 'maroon' | 'good' | 'warn' | 'bad' | 'dark';

export type StatusBadge = {
  label: string;
  tone: BadgeTone;
};

const unsafeCellStart = /^[=+@]/;
const cellNeedsQuotes = /[",\r\n]/;

function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : String(value);
  const guarded = typeof value === 'string' && unsafeCellStart.test(text) ? `'${text}` : text;
  const needsQuotes = cellNeedsQuotes.test(guarded) || guarded !== guarded.trim();
  return needsQuotes ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** RFC 4180 CSV with an Excel-friendly UTF-8 BOM and CRLF line endings. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => csvCell(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(','));
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`;
}

const rupeesPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/** "Rs. 1,250.50" → 125050 minor units. Rejects negatives, words and empty input. */
export function rupeesToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/^rs\.?/i, '').replace(/[,\s]/g, '');
  if (!rupeesPattern.test(cleaned)) return null;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const wholeMinor = Number(whole || '0') * 100;
  if (!Number.isSafeInteger(wholeMinor)) return null;
  const digits = fraction.padEnd(3, '0');
  const minor = wholeMinor + Number(digits.slice(0, 2)) + (Number(digits[2]) >= 5 ? 1 : 0);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units as a rupee number, for chart data and arithmetic. */
export function minorToRupees(minor: number): number {
  return minor / 100;
}

/** A compact rupee string suitable for an amount input: 125000000 → "1250000". */
export function minorToRupeesInput(minor: number): string {
  const rupees = minor / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

/** A two-decimal rupee string for CSV cells, without a currency prefix. */
export function minorForCsv(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Turns the discount field into contract units: minor units, or basis points for a percentage. */
export function discountInputToValue(type: 'amount' | 'percent', input: string): number {
  if (type === 'percent') {
    const percent = Number(input.trim());
    return Number.isFinite(percent) && percent > 0 ? Math.round(percent * 100) : 0;
  }
  return rupeesToMinor(input) ?? 0;
}

export function statusBadge(status: InvoiceStatus): StatusBadge {
  switch (status) {
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    case 'issued':
      return { label: 'Issued', tone: 'maroon' };
    case 'partially_paid':
      return { label: 'Partially paid', tone: 'warn' };
    case 'paid':
      return { label: 'Paid', tone: 'good' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'bad' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

export function sourceLabel(source: 'website' | 'walk-in'): string {
  return source === 'website' ? 'Website' : 'Walk-in';
}

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'card':
      return 'Card';
    default:
      return method;
  }
}

export function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '—';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  });
  return formatter.format(parsed);
}

export function monthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

export function isInvoiceOverdue(
  row: Pick<InvoiceRow, 'status' | 'balanceMinor' | 'issuedAt'>,
  now: Date = new Date(),
  days = 30,
): boolean {
  if (!row.issuedAt || row.balanceMinor <= 0) return false;
  if (row.status === 'draft' || row.status === 'cancelled' || row.status === 'paid') return false;
  const issued = Date.parse(row.issuedAt);
  if (Number.isNaN(issued)) return false;
  return now.getTime() - issued > days * 86_400_000;
}

export type InvoiceRowTotals = {
  count: number;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  outstanding: number;
};

export function sumInvoiceRows(rows: readonly InvoiceRow[]): InvoiceRowTotals {
  return rows.reduce<InvoiceRowTotals>((totals, row) => ({
    count: totals.count + 1,
    totalMinor: totals.totalMinor + row.totalMinor,
    paidMinor: totals.paidMinor + row.paidMinor,
    balanceMinor: totals.balanceMinor + row.balanceMinor,
    outstanding: totals.outstanding + (row.balanceMinor > 0 ? 1 : 0),
  }), { count: 0, totalMinor: 0, paidMinor: 0, balanceMinor: 0, outstanding: 0 });
}

function whatsappDigits(number: string | null | undefined): string | null {
  if (!number) return null;
  const normalised = normaliseLkPhone(number);
  const digits = normalised ? whatsappDigitsFor(normalised) : number.replace(/\D/g, '');
  return digits.length >= 9 ? digits : null;
}

export function whatsappHref(number: string | null | undefined, message: string): string | null {
  const digits = whatsappDigits(number);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

export type InvoiceWhatsappInput = {
  customerName: string;
  kind: 'invoice' | 'quotation';
  reference: string;
  totalMinor: number;
  pdfUrl: string;
};

export function invoiceWhatsappMessage(input: InvoiceWhatsappInput): string {
  const noun = input.kind === 'quotation' ? 'quotation' : 'invoice';
  const reference = input.reference.trim();
  const labelled = reference && reference.toLowerCase() !== 'draft' ? ` ${reference}` : '';
  const total = formatLkr(input.totalMinor, { decimals: true });
  const preamble = `Hi ${input.customerName}, here is your ${noun}${labelled}`;
  return `${preamble} from Sofa Factory Outlet: ${input.pdfUrl}\nTotal: ${total}.`;
}

export function invoiceWhatsappLink(
  number: string | null | undefined,
  input: InvoiceWhatsappInput,
): string | null {
  return whatsappHref(number, invoiceWhatsappMessage(input));
}

export function reviewRequestMessage(googleReviewUrl: string): string {
  const beginning = 'Thank you for choosing Sofa Factory Outlet. If you have a moment, ';
  return `${beginning}please leave us a Google review: ${googleReviewUrl}`;
}

export function reviewRequestLink(
  number: string | null | undefined,
  googleReviewUrl: string,
): string | null {
  return whatsappHref(number, reviewRequestMessage(googleReviewUrl));
}

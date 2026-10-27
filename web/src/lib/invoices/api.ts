import { notImplemented } from '../not-implemented';

// CONTRACT STUB. Owner: "invoices-core" agent. Keep these exports and signatures.

export type LineInput = { productId?: number; variantId?: number; description: string; colourName?: string; quantity: number; unitMinor: number; discountMinor?: number };

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

/** Pure function, no database: line totals, discount (amount, or percent in basis points), delivery, tax, advance and balance. All integer minor units. */
export const computeTotals: (input: TotalsInput) => Totals = () => notImplemented('computeTotals');

/** "Convert to invoice" on a booking: a draft invoice with the customer and the cart lines (colours included). */
export const createInvoiceFromBooking: (bookingId: number) => Promise<{ invoiceId: number }> = async () => notImplemented('createInvoiceFromBooking');

// All money is stored as integer minor units (cents) of LKR.

const grouping = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });
const groupingDecimals = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Rs. 12,490" for prices; pass `decimals` for invoices ("Rs. 1,250,000.00"). */
export function formatLkr(minor: number, options: { decimals?: boolean } = {}): string {
  const rupees = minor / 100;
  return `Rs. ${options.decimals ? groupingDecimals.format(rupees) : grouping.format(Math.round(rupees))}`;
}

/** Parses "12,490", "12490.50" or "Rs. 12,490" into minor units. */
export function parseLkr(input: string): number | null {
  const cleaned = input.replace(/rs\.?/i, '').replace(/[,\s]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** "1.5 lakhs" → 15,000,000 minor units; used by the chatbot's budget extraction. */
export const LAKH_MINOR = 100_000 * 100;

import { describe, expect, it } from 'vitest';
import type { InvoiceRow } from '@/lib/invoices/api';
import {
  discountInputToValue,
  formatInvoiceDate,
  invoiceWhatsappLink,
  invoiceWhatsappMessage,
  isInvoiceOverdue,
  minorForCsv,
  minorToRupees,
  minorToRupeesInput,
  reviewRequestLink,
  rupeesToMinor,
  statusBadge,
  sumInvoiceRows,
  toCsv,
  type CsvColumn,
} from '@/lib/admin/invoices';

type CsvRow = { name: string; note: string; amount: number; empty: string | null };

const columns: CsvColumn<CsvRow>[] = [
  { header: 'Name', value: (row) => row.name },
  { header: 'Note', value: (row) => row.note },
  { header: 'Amount', value: (row) => row.amount },
  { header: 'Empty', value: (row) => row.empty },
];

describe('toCsv', () => {
  it('starts with a BOM for Excel and uses CRLF line endings', () => {
    const csv = toCsv([{ name: 'Ada', note: 'Hello', amount: 1, empty: null }], columns);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('\uFEFFName,Note,Amount,Empty\r\nAda,Hello,1,\r\n');
  });

  it('quotes commas and doubles embedded quotes', () => {
    const csv = toCsv([{ name: 'Ada, "quoted"', note: '', amount: 2, empty: null }], columns);
    expect(csv).toContain('"Ada, ""quoted"""');
  });

  it('quotes and preserves embedded newlines', () => {
    const csv = toCsv([{ name: 'Ada', note: 'line one\nline two', amount: 3, empty: null }], columns);
    expect(csv).toContain('"line one\nline two"');
  });

  it('formats finite numbers without quotes and drops non-finite ones', () => {
    const csv = toCsv([
      { name: 'One', note: '', amount: 1250.5, empty: null },
      { name: 'Two', note: '', amount: Number.POSITIVE_INFINITY, empty: null },
    ], columns);
    expect(csv).toContain('One,,1250.5,');
    expect(csv).toContain('Two,,,');
  });

  it('guards spreadsheet formulas without changing numbers', () => {
    const csv = toCsv([{ name: '=SUM(A1)', note: '', amount: -5, empty: null }], columns);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain(',-5,');
  });

  it('quotes cells with surrounding spaces so Excel keeps them', () => {
    const csv = toCsv([{ name: ' Ada ', note: '', amount: 4, empty: null }], columns);
    expect(csv).toContain('" Ada "');
  });

  it('writes a header-only file when there are no rows', () => {
    expect(toCsv([], columns)).toBe('\uFEFFName,Note,Amount,Empty\r\n');
  });

  it('formats minor units as two-decimal rupees for money columns', () => {
    expect(minorForCsv(125000000)).toBe('1250000.00');
    expect(minorForCsv(1249050)).toBe('12490.50');
    expect(minorForCsv(1)).toBe('0.01');
  });
});

describe('invoice dates', () => {
  it('shows timestamped dates in Colombo time and date-only values as written', () => {
    expect(formatInvoiceDate('2026-01-01T20:00:00.000Z')).toBe('2 Jan 2026');
    expect(formatInvoiceDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatInvoiceDate('not-a-date')).toBe('—');
    expect(formatInvoiceDate(null)).toBe('—');
  });
});

describe('rupee and minor-unit conversion', () => {
  it('parses rupees with separators, a currency prefix and decimals', () => {
    expect(rupeesToMinor('12490')).toBe(1_249_000);
    expect(rupeesToMinor('12,490.50')).toBe(1_249_050);
    expect(rupeesToMinor('Rs. 1,250,000.00')).toBe(125_000_000);
    expect(rupeesToMinor('0.29')).toBe(29);
  });

  it('rounds a third decimal half up', () => {
    expect(rupeesToMinor('1.005')).toBe(101);
    expect(rupeesToMinor('10.999')).toBe(1_100);
    expect(rupeesToMinor('2.344')).toBe(234);
  });

  it('rejects negative, empty and non-numeric amounts', () => {
    expect(rupeesToMinor('-1')).toBeNull();
    expect(rupeesToMinor('-0.01')).toBeNull();
    expect(rupeesToMinor('')).toBeNull();
    expect(rupeesToMinor('Rs.')).toBeNull();
    expect(rupeesToMinor('12abc')).toBeNull();
    expect(rupeesToMinor('Infinity')).toBeNull();
    expect(rupeesToMinor('NaN')).toBeNull();
  });

  it('converts minor units back to rupees and input strings', () => {
    expect(minorToRupees(1_249_050)).toBe(12_490.5);
    expect(minorToRupeesInput(125_000_000)).toBe('1250000');
    expect(minorToRupeesInput(1_249_050)).toBe('12490.50');
  });

  it('round-trips values through the input helper', () => {
    expect(rupeesToMinor(minorToRupeesInput(1_249_050))).toBe(1_249_050);
    expect(rupeesToMinor(minorToRupeesInput(125_000_000))).toBe(125_000_000);
  });

  it('turns discount inputs into minor units or basis points', () => {
    expect(discountInputToValue('amount', '1,250')).toBe(125_000);
    expect(discountInputToValue('percent', '12.5')).toBe(1_250);
    expect(discountInputToValue('percent', '-2')).toBe(0);
    expect(discountInputToValue('amount', '-1')).toBe(0);
  });
});

describe('WhatsApp messages and links', () => {
  const message = invoiceWhatsappMessage({
    customerName: 'Nimal',
    kind: 'invoice',
    reference: 'SFO-2026-0001',
    totalMinor: 125_000_000,
    pdfUrl: 'https://example.test/api/invoices/1/pdf/',
  });

  it('mentions the customer, invoice number, total and PDF link', () => {
    expect(message).toContain('Nimal');
    expect(message).toContain('SFO-2026-0001');
    expect(message).toContain('Rs. 1,250,000.00');
    expect(message).toContain('https://example.test/api/invoices/1/pdf/');
  });

  it('builds a wa.me link with an encoded message from local and international numbers', () => {
    const input = {
      customerName: 'Nimal',
      kind: 'quotation' as const,
      reference: 'SFO-Q-2026-0001',
      totalMinor: 12_500,
      pdfUrl: 'https://example.test/quote.pdf',
    };
    const local = invoiceWhatsappLink('0771234567', input);
    const international = invoiceWhatsappLink('+94 77 123 4567', input);
    const expected = `https://wa.me/94771234567?text=${encodeURIComponent(invoiceWhatsappMessage(input))}`;
    expect(local).toBe(expected);
    expect(international).toBe(expected);
  });

  it('calls a quotation a quotation in the message', () => {
    const quotation = invoiceWhatsappMessage({
      customerName: 'Nimal',
      kind: 'quotation',
      reference: 'SFO-Q-2026-0001',
      totalMinor: 12_500,
      pdfUrl: 'https://example.test/quote.pdf',
    });
    expect(quotation).toContain('quotation SFO-Q-2026-0001');
  });

  it('returns null when the customer has no usable number', () => {
    expect(invoiceWhatsappLink('', {
      customerName: 'Nimal',
      kind: 'invoice',
      reference: 'SFO-2026-0001',
      totalMinor: 100,
      pdfUrl: 'https://example.test/invoice.pdf',
    })).toBeNull();
    expect(invoiceWhatsappLink('123', {
      customerName: 'Nimal',
      kind: 'invoice',
      reference: 'SFO-2026-0001',
      totalMinor: 100,
      pdfUrl: 'https://example.test/invoice.pdf',
    })).toBeNull();
  });

  it('builds the Google review link with the review URL prefilled', () => {
    const link = reviewRequestLink('0771234567', 'https://g.page/r/example/review');
    expect(link).not.toBeNull();
    expect(link).toContain('https://wa.me/94771234567?text=');
    expect(decodeURIComponent(link ?? '')).toContain('https://g.page/r/example/review');
  });
});

describe('status badges and list summaries', () => {
  it('maps every invoice status to a label and tone', () => {
    expect(statusBadge('draft')).toEqual({ label: 'Draft', tone: 'neutral' });
    expect(statusBadge('issued')).toEqual({ label: 'Issued', tone: 'maroon' });
    expect(statusBadge('partially_paid')).toEqual({ label: 'Partially paid', tone: 'warn' });
    expect(statusBadge('paid')).toEqual({ label: 'Paid', tone: 'good' });
    expect(statusBadge('cancelled')).toEqual({ label: 'Cancelled', tone: 'bad' });
  });

  const row = (overrides: Partial<InvoiceRow>): InvoiceRow => ({
    id: 1,
    number: 'SFO-2026-0001',
    type: 'invoice',
    status: 'issued',
    source: 'website',
    customerName: 'Nimal',
    customerPhone: '+94771234567',
    totalMinor: 100_000,
    paidMinor: 25_000,
    balanceMinor: 75_000,
    issuedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('sums the filtered rows and counts the balances', () => {
    const totals = sumInvoiceRows([
      row({ id: 1 }),
      row({ id: 2, status: 'paid', paidMinor: 100_000, balanceMinor: 0 }),
    ]);
    expect(totals).toEqual({
      count: 2,
      totalMinor: 200_000,
      paidMinor: 125_000,
      balanceMinor: 75_000,
      outstanding: 1,
    });
  });

  it('flags old, unpaid invoices as overdue only', () => {
    const now = new Date('2026-03-01T00:00:00.000Z');
    expect(isInvoiceOverdue(row({ issuedAt: '2026-01-01T00:00:00.000Z' }), now)).toBe(true);
    expect(isInvoiceOverdue(row({ issuedAt: '2026-02-20T00:00:00.000Z' }), now)).toBe(false);
    expect(isInvoiceOverdue(row({ status: 'paid', balanceMinor: 0 }), now)).toBe(false);
    expect(isInvoiceOverdue(row({ status: 'draft', balanceMinor: 10 }), now)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { computeTotals } from '@/lib/invoices/api';

describe('computeTotals', () => {
  it('applies line discounts and clamps a line at zero', () => {
    expect(computeTotals({ lines: [
      { description: 'Sofa', quantity: 2, unitMinor: 50_000, discountMinor: 5_000 },
      { description: 'Gift', quantity: 1, unitMinor: 1_000, discountMinor: 2_000 },
    ] }).subtotalMinor).toBe(95_000);
  });

  it('supports amount and percentage invoice discounts', () => {
    const lines = [{ description: 'Sofa', quantity: 1, unitMinor: 100_000 }];
    expect(computeTotals({ lines, discount: { type: 'amount', value: 12_500 } }).discountMinor).toBe(12_500);
    expect(computeTotals({ lines, discount: { type: 'percent', value: 1_250 } }).discountMinor).toBe(12_500);
  });

  it('clamps discounts and percentages', () => {
    const lines = [{ description: 'Sofa', quantity: 1, unitMinor: 100 }];
    expect(computeTotals({ lines, discount: { type: 'amount', value: 200 } }).totalMinor).toBe(0);
    expect(computeTotals({ lines, discount: { type: 'percent', value: 20_000 } }).totalMinor).toBe(0);
  });

  it('rounds tax half up exactly once', () => {
    expect(computeTotals({ lines: [{ description: 'Item', quantity: 1, unitMinor: 1 }], taxRateBp: 5_000 }).taxMinor).toBe(1);
  });

  it('adds delivery before tax and subtracts an advance from the balance', () => {
    expect(computeTotals({
      lines: [{ description: 'Sofa', quantity: 1, unitMinor: 100_000 }],
      deliveryMinor: 10_000, taxRateBp: 1_000, paidMinor: 20_000,
    })).toEqual({ subtotalMinor: 100_000, discountMinor: 0, deliveryMinor: 10_000, taxMinor: 11_000, totalMinor: 121_000, paidMinor: 20_000, balanceMinor: 101_000 });
  });

  it('never returns negative totals or balances', () => {
    const result = computeTotals({ lines: [{ description: 'Bad input', quantity: -1, unitMinor: -100, discountMinor: -20 }], deliveryMinor: -1, taxRateBp: -1, paidMinor: 500 });
    expect(Object.values(result).every((value) => value >= 0)).toBe(true);
    expect(result.balanceMinor).toBe(0);
  });

  it('handles the plan-scale invoice example using integer cents', () => {
    const result = computeTotals({ lines: [{ description: 'Order', quantity: 1, unitMinor: 125_000_000 }] });
    expect(result.totalMinor).toBe(125_000_000);
  });
});

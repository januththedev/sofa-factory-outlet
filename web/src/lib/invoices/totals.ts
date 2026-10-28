import type { Totals, TotalsInput } from './api';

const nonNegativeInteger = (value: number | undefined): number =>
  Number.isSafeInteger(value) && (value ?? 0) > 0 ? (value as number) : 0;

const roundRatio = (amount: number, basisPoints: number): number =>
  Math.floor((amount * basisPoints + 5_000) / 10_000);

export function computeTotals(input: TotalsInput): Totals {
  const subtotalMinor = input.lines.reduce((sum, line) => {
    const quantity = nonNegativeInteger(line.quantity);
    const unitMinor = nonNegativeInteger(line.unitMinor);
    const discountMinor = nonNegativeInteger(line.discountMinor);
    return sum + Math.max(0, quantity * unitMinor - discountMinor);
  }, 0);

  const discountValue = nonNegativeInteger(input.discount?.value);
  const discountMinor = input.discount?.type === 'percent'
    ? roundRatio(subtotalMinor, Math.min(10_000, discountValue))
    : Math.min(subtotalMinor, discountValue);
  const deliveryMinor = nonNegativeInteger(input.deliveryMinor);
  const taxableMinor = subtotalMinor - discountMinor + deliveryMinor;
  const taxRateBp = Math.min(10_000, nonNegativeInteger(input.taxRateBp));
  const taxMinor = roundRatio(taxableMinor, taxRateBp);
  const totalMinor = taxableMinor + taxMinor;
  const paidMinor = nonNegativeInteger(input.paidMinor);

  return {
    subtotalMinor,
    discountMinor,
    deliveryMinor,
    taxMinor,
    totalMinor,
    paidMinor,
    balanceMinor: Math.max(0, totalMinor - paidMinor),
  };
}

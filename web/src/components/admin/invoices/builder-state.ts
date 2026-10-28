export function stepQuantity(value: string, direction: -1 | 1): string {
  const quantity = Number(value);
  const current = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  return String(Math.max(1, current + direction));
}

export function keyboardInset(height: number, viewportHeight: number, offsetTop: number): number {
  if (![height, viewportHeight, offsetTop].every(Number.isFinite)) return 0;
  return Math.max(0, height - viewportHeight - offsetTop);
}

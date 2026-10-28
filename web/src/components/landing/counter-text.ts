export function formatCounterText(value: number, prefix = '', suffix = ''): string {
  return `${prefix}${Math.round(value).toLocaleString('en-US')}${suffix}`;
}

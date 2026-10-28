import { z } from 'zod';

const key = 'sfo-shop-results';
const pendingKey = 'sfo-pending-results';
const entryKey = 'sfoShopResults';
export const resultsEvent = 'sfo-results-ready';
const memorySchema = z.object({
  url: z.string().regex(/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/(?:\?[^#\\]*)?$/),
  product: z.string().regex(/^\/product\/[a-z0-9-]+\/$/),
  scroll: z.number().finite().nonnegative(),
  returning: z.boolean(),
});

export function readResults() {
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function parseResults(value: string) {
  try {
    const result = memorySchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function rememberResults(product: string) {
  try {
    const memory = {
      url: `${window.location.pathname}${window.location.search}`,
      product,
      scroll: window.scrollY,
      returning: false,
    };
    sessionStorage.setItem(key, JSON.stringify(memory));
    sessionStorage.setItem(pendingKey, JSON.stringify({ memory, createdAt: Date.now() }));
  } catch {
    // Native history still restores the list when storage is unavailable.
  }
}

export function readProductResults() {
  try {
    return JSON.stringify(window.history.state?.[entryKey] ?? null);
  } catch {
    return '';
  }
}

/** Associate a shop click with this history entry, so a later direct visit uses the category fallback. */
export function attachProductResults(product: string) {
  try {
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return;
    sessionStorage.removeItem(pendingKey);
    const parsed = z.object({ memory: memorySchema, createdAt: z.number() }).safeParse(JSON.parse(pending));
    if (!parsed.success || parsed.data.memory.product !== product) return;
    const age = Date.now() - parsed.data.createdAt;
    if (age < 0 || age > 60_000) return;
    window.history.replaceState({ ...window.history.state, [entryKey]: parsed.data.memory }, '');
    window.dispatchEvent(new Event(resultsEvent));
  } catch {
    // Without a matching history entry the product links back to its category.
  }
}

export function markReturning(snapshot = readProductResults()) {
  const memory = parseResults(snapshot);
  if (!memory) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...memory, returning: true }));
  } catch {
    // Native history remains available.
  }
}

export function restoreResults() {
  const memory = parseResults(readResults());
  if (!memory || !memory.returning) return;
  if (memory.url !== `${window.location.pathname}${window.location.search}`) return;
  const frame = window.requestAnimationFrame(() => window.scrollTo({ top: memory.scroll, behavior: 'instant' }));
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...memory, returning: false }));
  } catch {
    // The restored position does not depend on storage being writable.
  }
  return () => window.cancelAnimationFrame(frame);
}

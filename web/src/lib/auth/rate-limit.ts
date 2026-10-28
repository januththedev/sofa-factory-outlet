// A small in-memory failure counter for sign-in. It is per server instance: on
// serverless hosting every warm instance counts for itself, which still slows a
// guessing attack down a lot. It never stores passwords.

export type FailureLimiter = {
  /** True once `max` failures have been recorded inside the window. */
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
  reset(key: string): void;
  size(): number;
};

type LimiterOptions = {
  max: number;
  windowMs: number;
  /** Upper bound on tracked keys; the oldest are dropped first so memory stays small. */
  maxKeys?: number;
  now?: () => number;
};

export function createFailureLimiter({ max, windowMs, maxKeys = 5000, now = Date.now }: LimiterOptions): FailureLimiter {
  const failures = new Map<string, number[]>();

  const recent = (key: string): number[] => {
    const times = failures.get(key);
    if (!times) return [];
    const cutoff = now() - windowMs;
    const kept = times.filter((time) => time > cutoff);
    if (kept.length === 0) failures.delete(key);
    else if (kept.length !== times.length) failures.set(key, kept);
    return kept;
  };

  return {
    isBlocked: (key) => recent(key).length >= max,
    recordFailure(key) {
      const times = recent(key);
      times.push(now());
      // Re-insert so the Map's insertion order doubles as "least recently failed first".
      failures.delete(key);
      failures.set(key, times.slice(-max));
      while (failures.size > maxKeys) {
        const oldest = failures.keys().next().value;
        if (oldest === undefined) break;
        failures.delete(oldest);
      }
    },
    reset: (key) => void failures.delete(key),
    size: () => failures.size,
  };
}

export const MAX_FAILURES_PER_EMAIL_AND_IP = 5;
export const MAX_FAILURES_PER_IP = 20;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export type LoginLimiter = {
  isBlocked(email: string, ip: string): boolean;
  recordFailure(email: string, ip: string): void;
  recordSuccess(email: string, ip: string): void;
};

export function createLoginLimiter(now: () => number = Date.now): LoginLimiter {
  const perPair = createFailureLimiter({ max: MAX_FAILURES_PER_EMAIL_AND_IP, windowMs: FAILURE_WINDOW_MS, now });
  // A second, looser cap per address, so one machine cannot spray many different emails.
  const perIp = createFailureLimiter({ max: MAX_FAILURES_PER_IP, windowMs: FAILURE_WINDOW_MS, now });
  const pair = (email: string, ip: string) => `${email.trim().toLowerCase().slice(0, 254)}|${ip}`;
  return {
    isBlocked: (email, ip) => perPair.isBlocked(pair(email, ip)) || perIp.isBlocked(ip),
    recordFailure(email, ip) {
      perPair.recordFailure(pair(email, ip));
      perIp.recordFailure(ip);
    },
    // A good sign-in clears that person's own counter; the per-address cap keeps counting.
    recordSuccess: (email, ip) => perPair.reset(pair(email, ip)),
  };
}

// One shared counter per process: Next compiles route handlers and server actions
// into separate bundles, and both can authorise a sign-in.
const g = globalThis as unknown as { __sfoLoginLimiter?: LoginLimiter };
const shared = (): LoginLimiter => (g.__sfoLoginLimiter ??= createLoginLimiter());
export const loginLimiter: LoginLimiter = {
  isBlocked: (email, ip) => shared().isBlocked(email, ip),
  recordFailure: (email, ip) => shared().recordFailure(email, ip),
  recordSuccess: (email, ip) => shared().recordSuccess(email, ip),
};

/** Test helper: forget every recorded failure. */
export function resetLoginLimiter(): void {
  g.__sfoLoginLimiter = createLoginLimiter();
}

/**
 * Best-effort caller address for rate limiting. Vercel and most proxies put the
 * client first in `x-forwarded-for`; without a proxy the header is absent and
 * everything shares the "unknown" bucket.
 */
export function clientIp(headers: Pick<Headers, 'get'>): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const candidate = forwarded || headers.get('x-real-ip')?.trim() || '';
  return /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : 'unknown';
}

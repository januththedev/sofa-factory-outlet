export type RedirectEntry = { from: string; to: string | null; status: 301 | 410 };
export type RedirectMap = Map<string, Omit<RedirectEntry, 'from'>>;

export function normaliseRedirectPath(path: string): string {
  const value = path.startsWith('/') ? path : `/${path}`;
  return value === '/' || value.endsWith('/') ? value : `${value}/`;
}

export function buildRedirectMap(rows: RedirectEntry[]): RedirectMap {
  return new Map(rows.map(({ from, to, status }) => [normaliseRedirectPath(from), { to, status }]));
}

export class RedirectCache {
  private map: RedirectMap = new Map();
  private fetchedAt = Number.NEGATIVE_INFINITY;
  private pending?: Promise<void>;
  private retryAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly load: () => Promise<RedirectEntry[]>, private readonly ttlMs = 30_000, private readonly now = Date.now) {}

  private async refresh(): Promise<void> {
    if (!this.pending) {
      this.pending = this.load().then((rows) => {
        this.map = buildRedirectMap(rows);
        this.fetchedAt = this.now();
        this.retryAt = Number.NEGATIVE_INFINITY;
      }).catch(() => {
        // Keep the last good map during an outage and avoid a retry on every incoming request.
        this.retryAt = this.now() + Math.min(this.ttlMs, 5000);
      }).finally(() => { this.pending = undefined; });
    }
    await this.pending;
  }

  async get(path: string): Promise<Omit<RedirectEntry, 'from'> | undefined> {
    if (this.now() - this.fetchedAt >= this.ttlMs && this.now() >= this.retryAt) await this.refresh();
    return this.map.get(normaliseRedirectPath(path));
  }
}

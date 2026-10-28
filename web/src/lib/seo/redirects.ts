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

  constructor(private readonly load: () => Promise<RedirectEntry[]>, private readonly ttlMs = 30_000, private readonly now = Date.now) {}

  private async refresh(): Promise<void> {
    if (!this.pending) {
      this.pending = this.load().then((rows) => { this.map = buildRedirectMap(rows); this.fetchedAt = this.now(); }).finally(() => { this.pending = undefined; });
    }
    await this.pending;
  }

  async get(path: string): Promise<Omit<RedirectEntry, 'from'> | undefined> {
    const key = normaliseRedirectPath(path);
    const stale = this.now() - this.fetchedAt >= this.ttlMs;
    if (stale) await this.refresh();
    const hit = this.map.get(key);
    if (!hit && !stale && this.now() - this.fetchedAt >= this.ttlMs) await this.refresh();
    return this.map.get(key);
  }
}

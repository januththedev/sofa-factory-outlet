export const CAMPAIGN_COOKIE = 'sfo-campaign';
const KEYS = [
  'source',
  'medium',
  'campaign',
  'first_source',
  'first_medium',
  'first_campaign',
  'landing',
] as const;
/** Attribution is advisory metadata. Accept only bounded, named fields, never arbitrary cookie JSON. */
export function readCampaign(
  value: string | undefined,
): Record<string, string> {
  try {
    if (!value || value.length > 6000) return {};
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { parsed = JSON.parse(decodeURIComponent(value)); }
    if (!parsed || typeof parsed !== 'object') return {};
    const record = parsed as Record<string, unknown>;
    return Object.fromEntries(
      KEYS.flatMap((key) =>
        typeof record[key] === 'string'
          ? [[key, record[key].slice(0, 200)]]
          : [],
      ),
    );
  } catch {
    return {};
  }
}
export function captureCampaign(
  url: URL,
  previous: Record<string, string>,
): Record<string, string> | null {
  const current: Record<string, string> = {};
  for (const key of ['source', 'medium', 'campaign']) {
    const value = url.searchParams.get(`utm_${key}`)?.slice(0, 200);
    if (value) current[key] = value;
  }
  if (!Object.keys(current).length) return null;
  return {
    ...current,
    ...Object.fromEntries(
      ['source', 'medium', 'campaign'].flatMap((key) => {
        const value = previous[`first_${key}`] ?? previous[key] ?? current[key];
        return value ? [[`first_${key}`, value]] : [];
      }),
    ),
    landing: previous.landing ?? url.pathname.slice(0, 200),
  };
}

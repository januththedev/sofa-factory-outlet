import { describe, expect, it, vi } from 'vitest';
import {
  buildJwtClaims,
  buildQueryBody,
  type DailyRow,
  fetchRecentRows,
  getGscStatus,
  GSC_API_ROOT,
  GSC_ROW_LIMIT,
  GSC_SCOPE,
  GSC_TOKEN_URL,
  GscError,
  type JwtSigner,
  parseSearchAnalyticsResponse,
  recentRange,
  requestAccessToken,
  resolveGscConfig,
  searchAnalyticsUrl,
  toDailyRows,
} from '@/lib/seo/gsc';

const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIFAKEKEYFORTESTS\n-----END PRIVATE KEY-----\n';
const serviceAccount = { client_email: 'seo-bot@sofa-test.iam.gserviceaccount.com', private_key: PRIVATE_KEY };
const encoded = Buffer.from(JSON.stringify(serviceAccount)).toString('base64');
const SITE = 'sc-domain:sofa-test.example';

const config = { clientEmail: serviceAccount.client_email, privateKey: PRIVATE_KEY, siteUrl: SITE };

const sign: JwtSigner = vi.fn(async () => 'signed-jwt');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A fetch that answers each call with the next handler and remembers what it was asked. */
function fakeFetch(...answers: Array<() => Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const send = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    const answer = answers[calls.length - 1];
    if (!answer) throw new Error('Unexpected extra request');
    return answer();
  };
  return { fetch: send as unknown as typeof fetch, calls };
}

const apiRow = (date: string, query: string, page: string, clicks: number, impressions: number, position: number) => ({
  keys: [date, query, page],
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
});

describe('reading the Search Console settings', () => {
  it('reports plain "not configured" when nothing is set', () => {
    expect(resolveGscConfig({})).toEqual({ configured: false });
    expect(resolveGscConfig({ GSC_SERVICE_ACCOUNT_JSON: '', GSC_SITE_URL: '  ' })).toEqual({ configured: false });
  });

  it('names the missing half when only one setting is present', () => {
    expect(resolveGscConfig({ GSC_SITE_URL: SITE })).toMatchObject({
      configured: false,
      problem: expect.stringContaining('GSC_SERVICE_ACCOUNT_JSON'),
    });
    expect(resolveGscConfig({ GSC_SERVICE_ACCOUNT_JSON: encoded })).toMatchObject({
      configured: false,
      problem: expect.stringContaining('GSC_SITE_URL'),
    });
  });

  it('reads a base64 key file', () => {
    expect(resolveGscConfig({ GSC_SERVICE_ACCOUNT_JSON: encoded, GSC_SITE_URL: SITE })).toEqual({
      configured: true,
      config,
    });
  });

  it('also accepts the key file pasted as plain JSON', () => {
    const result = resolveGscConfig({ GSC_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount), GSC_SITE_URL: SITE });
    expect(result).toEqual({ configured: true, config });
  });

  it('repairs a key whose line breaks arrived as a backslash and an n', () => {
    const flattened = '-----BEGIN PRIVATE KEY-----\\nABC\\nDEF\\n-----END PRIVATE KEY-----';
    const result = resolveGscConfig({
      GSC_SERVICE_ACCOUNT_JSON: JSON.stringify({ ...serviceAccount, private_key: flattened }),
      GSC_SITE_URL: SITE,
    });
    expect(result.configured && result.config.privateKey).toBe(
      '-----BEGIN PRIVATE KEY-----\nABC\nDEF\n-----END PRIVATE KEY-----',
    );
  });

  it('says what is wrong with an unreadable key without echoing it', () => {
    const result = resolveGscConfig({ GSC_SERVICE_ACCOUNT_JSON: 'not-a-key-secret-123', GSC_SITE_URL: SITE });
    expect(result.configured).toBe(false);
    expect(JSON.stringify(result)).toContain('base64');
    expect(JSON.stringify(result)).not.toContain('secret-123');
    const incomplete = Buffer.from(JSON.stringify({ client_email: 'a@b.c' })).toString('base64');
    expect(resolveGscConfig({ GSC_SERVICE_ACCOUNT_JSON: incomplete, GSC_SITE_URL: SITE }).configured).toBe(false);
  });

  it('shows the admin page the service account email but never the key', () => {
    const status = getGscStatus({ GSC_SERVICE_ACCOUNT_JSON: encoded, GSC_SITE_URL: SITE });
    expect(status).toEqual({ configured: true, siteUrl: SITE, clientEmail: serviceAccount.client_email });
    expect(JSON.stringify(status)).not.toContain('MIIFAKE');
    expect(getGscStatus({})).toEqual({ configured: false });
  });
});

describe('signing in to Google', () => {
  it('builds the claims Google expects, valid for one hour', () => {
    expect(buildJwtClaims(config.clientEmail, 1_800_000_000)).toEqual({
      iss: config.clientEmail,
      scope: GSC_SCOPE,
      aud: GSC_TOKEN_URL,
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    expect(GSC_SCOPE).toBe('https://www.googleapis.com/auth/webmasters.readonly');
  });

  it('swaps the signed assertion for an access token', async () => {
    const { fetch, calls } = fakeFetch(() =>
      json({ access_token: 'token-123', expires_in: 3599, token_type: 'Bearer' }),
    );
    const signer = vi.fn<JwtSigner>(async () => 'signed-jwt');
    const token = await requestAccessToken(config, { fetch, sign: signer, now: () => 1_800_000_123_456 });
    expect(token).toBe('token-123');
    expect(signer).toHaveBeenCalledWith(buildJwtClaims(config.clientEmail, 1_800_000_123), PRIVATE_KEY);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');
    expect(calls[0].init.method).toBe('POST');
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(form.get('assertion')).toBe('signed-jwt');
  });

  it('explains a refusal from Google', async () => {
    const { fetch } = fakeFetch(() =>
      json({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }, 400),
    );
    const attempt = requestAccessToken(config, { fetch, sign });
    await expect(attempt).rejects.toBeInstanceOf(GscError);
    await expect(attempt).rejects.toThrow(/\(400\).*invalid_grant.*Invalid JWT Signature/);
  });

  it('fails clearly when Google answers without a token', async () => {
    const { fetch } = fakeFetch(() => json({ nothing: true }));
    await expect(requestAccessToken(config, { fetch, sign })).rejects.toThrow('no access token');
  });
});

describe('asking for rows', () => {
  it('pulls the last three days up to yesterday', () => {
    expect(recentRange(new Date('2026-10-28T10:00:00Z'))).toEqual({ startDate: '2026-10-25', endDate: '2026-10-27' });
    expect(recentRange(new Date('2026-01-02T23:59:00Z'), 1)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    });
    expect(recentRange(new Date('2026-03-01T00:00:00Z'), 3)).toEqual({
      startDate: '2026-02-26',
      endDate: '2026-02-28',
    });
  });

  it('puts the site in the path, encoded', () => {
    expect(searchAnalyticsUrl('sc-domain:sofa-test.example')).toBe(
      `${GSC_API_ROOT}/sc-domain%3Asofa-test.example/searchAnalytics/query`,
    );
    expect(searchAnalyticsUrl('https://sofa-test.example/')).toBe(
      `${GSC_API_ROOT}/https%3A%2F%2Fsofa-test.example%2F/searchAnalytics/query`,
    );
  });

  it('asks for date, query and page with a 5000 row limit', () => {
    expect(buildQueryBody({ startDate: '2026-10-25', endDate: '2026-10-27' })).toMatchObject({
      startDate: '2026-10-25',
      endDate: '2026-10-27',
      dimensions: ['date', 'query', 'page'],
      rowLimit: 5000,
    });
    expect(GSC_ROW_LIMIT).toBe(5000);
  });
});

describe('reading the answer', () => {
  const page = 'https://sofa-test.example/sofas/';

  it('turns API rows into table rows and skips the ones it cannot use', () => {
    const { rows, skipped } = parseSearchAnalyticsResponse({
      rows: [
        apiRow('2026-10-25', 'sofa sri lanka', page, 3, 120, 7.4),
        { keys: ['2026-10-25', 'only two keys'], clicks: 1, impressions: 1, ctr: 1, position: 1 },
        apiRow('yesterday', 'bad date', page, 1, 1, 1),
        { keys: ['2026-10-26', 'q', page], clicks: 'many', impressions: 1, ctr: 1, position: 1 },
        apiRow('2026-10-26', 'sofa sri lanka', page, 2, 80, 6.1),
      ],
      responseAggregationType: 'byPage',
    });
    expect(skipped).toBe(3);
    expect(rows).toEqual([
      { date: '2026-10-25', query: 'sofa sri lanka', page, clicks: 3, impressions: 120, ctr: 0.025, position: 7.4 },
      { date: '2026-10-26', query: 'sofa sri lanka', page, clicks: 2, impressions: 80, ctr: 0.025, position: 6.1 },
    ]);
  });

  it('treats an answer with no rows key as no data', () => {
    expect(parseSearchAnalyticsResponse({})).toEqual({ rows: [], skipped: 0 });
    expect(parseSearchAnalyticsResponse({ rows: [] })).toEqual({ rows: [], skipped: 0 });
  });

  it('refuses an answer that is not an object', () => {
    for (const bad of [null, 'text', 42, { rows: 5 }]) {
      expect(() => parseSearchAnalyticsResponse(bad)).toThrow(GscError);
    }
  });
});

describe('shaping rows for the upsert', () => {
  const base: DailyRow = {
    date: '2026-10-25',
    query: 'sofa sri lanka',
    page: 'https://sofa-test.example/sofas/',
    clicks: 3,
    impressions: 100,
    ctr: 0.03,
    position: 4,
  };

  it('keeps distinct rows as they are, in order, with the click-through rate worked out', () => {
    const shaped = toDailyRows([base, { ...base, query: 'corner sofa price', ctr: 0 }]);
    expect(shaped.map((row) => row.query)).toEqual(['sofa sri lanka', 'corner sofa price']);
    expect(shaped[0]).toEqual(base);
    expect(shaped[1].ctr).toBeCloseTo(0.03, 10);
  });

  it('merges rows for the same date, search and page so one INSERT never hits a row twice', () => {
    const [merged, ...rest] = toDailyRows([base, { ...base, clicks: 1, impressions: 300, position: 8 }]);
    expect(rest).toEqual([]);
    expect(merged.clicks).toBe(4);
    expect(merged.impressions).toBe(400);
    expect(merged.position).toBeCloseTo((4 * 100 + 8 * 300) / 400, 10);
    expect(merged.ctr).toBeCloseTo(4 / 400, 10);
  });

  it('rounds to whole numbers, trims text and never goes negative', () => {
    const [shaped] = toDailyRows([
      {
        ...base,
        query: '  sofa sri lanka ',
        page: ' https://sofa-test.example/sofas/ ',
        clicks: 2.6,
        impressions: 99.4,
        position: -1,
      },
    ]);
    expect(shaped).toMatchObject({ query: 'sofa sri lanka', page: base.page, clicks: 3, impressions: 99, position: 0 });
  });

  it('gives a row with no impressions a click-through rate of zero', () => {
    expect(toDailyRows([{ ...base, clicks: 0, impressions: 0, ctr: 0.5 }])[0].ctr).toBe(0);
  });

  it('is happy with nothing to do', () => {
    expect(toDailyRows([])).toEqual([]);
  });
});

describe('the whole pull, with Google replaced by fakes', () => {
  const source = { GSC_SERVICE_ACCOUNT_JSON: encoded, GSC_SITE_URL: SITE };
  const now = new Date('2026-10-28T10:00:00Z');

  it('does nothing and calls nothing when Search Console is not connected', async () => {
    const { fetch, calls } = fakeFetch();
    const signer = vi.fn<JwtSigner>(async () => 'never');
    expect(await fetchRecentRows({ source: {}, now, deps: { fetch, sign: signer } })).toEqual({ configured: false });
    expect(calls).toHaveLength(0);
    expect(signer).not.toHaveBeenCalled();
  });

  it('signs in, asks for the last three days and returns shaped rows', async () => {
    const page = 'https://sofa-test.example/sofas/';
    const { fetch, calls } = fakeFetch(
      () => json({ access_token: 'token-abc' }),
      () =>
        json({
          rows: [apiRow('2026-10-27', 'sofa sri lanka', page, 2, 50, 5.5), { keys: ['broken'], clicks: 1 }],
        }),
    );
    const result = await fetchRecentRows({ source, now, deps: { fetch, sign, now: () => now.getTime() } });
    expect(result).toEqual({
      configured: true,
      range: { startDate: '2026-10-25', endDate: '2026-10-27' },
      rows: [
        { date: '2026-10-27', query: 'sofa sri lanka', page, clicks: 2, impressions: 50, ctr: 0.04, position: 5.5 },
      ],
      skipped: 1,
    });
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe(searchAnalyticsUrl(SITE));
    expect(calls[1].init.method).toBe('POST');
    expect(calls[1].init.headers).toMatchObject({ authorization: 'Bearer token-abc' });
    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({
      startDate: '2026-10-25',
      endDate: '2026-10-27',
      dimensions: ['date', 'query', 'page'],
      rowLimit: 5000,
    });
  });

  it('passes on what Google says when the site is not shared with the service account', async () => {
    const denied = { error: { code: 403, message: 'User does not have sufficient permission for site' } };
    const { fetch } = fakeFetch(
      () => json({ access_token: 'token-abc' }),
      () => json(denied, 403),
    );
    const attempt = fetchRecentRows({ source, now, deps: { fetch, sign } });
    await expect(attempt).rejects.toThrow(/\(403\).*sufficient permission/);
  });
});

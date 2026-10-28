import Link from 'next/link';
import { ConnectCard } from '@/components/admin/seo/connect-card';
import { TrendChart } from '@/components/admin/seo/trend-chart';
import { EmptyNote, StatGrid } from '@/components/admin/seo/ui';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { getSearchOverview, getSeoProblems, type SearchOverview, type SeoProblems } from '@/lib/admin/seo';
import { getGscStatus } from '@/lib/seo/gsc';
import { formatCount, formatPosition } from '@/lib/seo/report';

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLabel = (date: string): string => dayFormat.format(new Date(`${date}T00:00:00Z`));

/** The site's own address for a page Google reported, so staff can click through. */
function pagePath(page: string): string {
  try {
    const url = new URL(page);
    return `${url.pathname}${url.search}`;
  } catch {
    return page;
  }
}

export async function OverviewTab() {
  const [overview, problems] = await Promise.all([getSearchOverview(), getSeoProblems()]);
  const status = getGscStatus();

  return (
    <div className="space-y-6">
      {overview.hasData ? <Rankings overview={overview} /> : <ConnectCard status={status} />}
      <Problems problems={problems} />
    </div>
  );
}

function Rankings({ overview }: { overview: SearchOverview }) {
  const { totals, priority, trend, topPages } = overview;
  const trendView = trend.map((point) => ({ ...point, label: dayLabel(point.date) }));
  return (
    <>
      <p className="text-sm text-mute">
        The 20 priority searches, {dayLabel(overview.from)} to {dayLabel(overview.to)} (Asia/Colombo days).
      </p>
      <StatGrid
        stats={[
          { label: 'Clicks', value: formatCount(totals.clicks), hint: 'From the 20 priority searches' },
          { label: 'Impressions', value: formatCount(totals.impressions), hint: 'Times they showed in results' },
          {
            label: 'Average position',
            value: formatPosition(totals.position),
            hint: 'Weighted by impressions; 1 is the top',
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
        </CardHeader>
        <CardBody>
          {trendView.length > 0 ? (
            <TrendChart data={trendView} />
          ) : (
            <p className="py-6 text-center text-sm text-mute">None of the priority searches has appeared yet.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Priority searches</CardTitle>
        </CardHeader>
        <Table>
          <caption className="sr-only">Clicks, impressions and position for each priority search</caption>
          <THead>
            <TR>
              <TH scope="col">Search</TH>
              <TH scope="col">Target page</TH>
              <TH scope="col" className="text-right">
                Clicks
              </TH>
              <TH scope="col" className="text-right">
                Impressions
              </TH>
              <TH scope="col" className="text-right">
                Position
              </TH>
            </TR>
          </THead>
          <TBody>
            {priority.map((row) => (
              <TR key={row.query}>
                <TD className="font-medium">{row.query}</TD>
                <TD className="text-mute">{row.page}</TD>
                <TD className="text-right tabular-nums">{formatCount(row.clicks)}</TD>
                <TD className="text-right tabular-nums">{formatCount(row.impressions)}</TD>
                <TD className="text-right tabular-nums">{formatPosition(row.position)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Top pages</CardTitle>
        </CardHeader>
        {topPages.length === 0 ? (
          <EmptyNote>No pages have earned clicks yet.</EmptyNote>
        ) : (
          <Table>
            <caption className="sr-only">Pages that earned the most clicks from Google</caption>
            <THead>
              <TR>
                <TH scope="col">Page</TH>
                <TH scope="col" className="text-right">
                  Clicks
                </TH>
                <TH scope="col" className="text-right">
                  Impressions
                </TH>
                <TH scope="col" className="text-right">
                  Position
                </TH>
              </TR>
            </THead>
            <TBody>
              {topPages.map((row) => (
                <TR key={row.page}>
                  <TD className="max-w-[28rem] break-all">{pagePath(row.page)}</TD>
                  <TD className="text-right tabular-nums">{formatCount(row.clicks)}</TD>
                  <TD className="text-right tabular-nums">{formatCount(row.impressions)}</TD>
                  <TD className="text-right tabular-nums">{formatPosition(row.position)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Problems({ problems }: { problems: SeoProblems }) {
  const { weakProducts, noindexProducts, hiddenWithRedirects, checklistAvailable } = problems;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pages with problems</CardTitle>
      </CardHeader>
      <CardBody className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="problem-checklist">
          <h3 id="problem-checklist" className="font-semibold">
            Products failing the SEO checklist
          </h3>
          {!checklistAvailable ? (
            <p className="mt-2 text-sm text-mute">— The SEO checklist is not available yet.</p>
          ) : weakProducts.length === 0 ? (
            <p className="mt-2 text-sm text-mute">Every published product is green.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {weakProducts.map((product) => (
                <li key={product.id}>
                  <Link href={`/admin/products/${product.id}/`} className="font-medium text-maroon hover:underline">
                    {product.name}
                  </Link>{' '}
                  <Badge tone={product.score === 'red' ? 'bad' : 'warn'}>
                    {product.score === 'red' ? 'Red' : 'Amber'}
                  </Badge>
                  <p className="mt-0.5 text-mute">Needs: {product.failing.join(', ')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="problem-noindex">
          <h3 id="problem-noindex" className="font-semibold">
            Published but hidden from Google
          </h3>
          {noindexProducts.length === 0 ? (
            <p className="mt-2 text-sm text-mute">No published product is set to noindex.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {noindexProducts.map((product) => (
                <li key={product.id}>
                  <Link href={`/admin/products/${product.id}/`} className="font-medium text-maroon hover:underline">
                    {product.name}
                  </Link>
                  <span className="text-mute"> /product/{product.slug}/ is marked noindex</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="problem-hidden">
          <h3 id="problem-hidden" className="font-semibold">
            Hidden products still being visited
          </h3>
          {hiddenWithRedirects.length === 0 ? (
            <p className="mt-2 text-sm text-mute">No visitors are arriving on a hidden product&apos;s old address.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {hiddenWithRedirects.map((redirect) => (
                <li key={redirect.id}>
                  <span className="break-all font-medium">{redirect.from}</span>
                  <span className="text-mute">
                    {' '}
                    sent {redirect.hits} {redirect.hits === 1 ? 'visit' : 'visits'} to {redirect.to ?? 'a gone page'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardBody>
    </Card>
  );
}

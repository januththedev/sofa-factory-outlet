import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { BarList } from '@/components/admin/visitors/bar-list';
import { ChatbotPanel } from '@/components/admin/visitors/chatbot-panel';
import { FunnelChart } from '@/components/admin/visitors/funnel-chart';
import { LiveCount } from '@/components/admin/visitors/live-count';
import { NoData } from '@/components/admin/visitors/no-data';
import { RangeSelector } from '@/components/admin/visitors/range-selector';
import { StatCards } from '@/components/admin/visitors/stat-cards';
import { TrafficChart } from '@/components/admin/visitors/traffic-chart';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { getVisitorsOverview } from '@/lib/analytics/queries';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  direct: 'Direct',
  other: 'Other',
};

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ days?: string | string[] }> }) {
  await requireRole('any');
  const params = await searchParams;
  const requested = Array.isArray(params.days) ? params.days[0] : params.days;
  const days = requested === '30' ? 30 : 7;
  const data = await getVisitorsOverview(days);

  const { totals, traffic, sources, funnel, products, audience, chatbot } = data;
  const trafficView = traffic.map((point) => ({ ...point, label: dayLabel(point.date) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description={
          `Traffic, sources and what people do on the site. ` +
          `${dayLabel(data.from)} – ${dayLabel(data.to)}, in Asia/Colombo days.`
        }
        actions={<RangeSelector days={days} />}
      />

      <StatCards
        stats={[
          {
            label: 'Visitors',
            value: totals.visitors.toLocaleString('en-LK'),
            hint: `Distinct visitors in ${days} days`,
          },
          { label: 'Sessions', value: totals.sessions.toLocaleString('en-LK') },
          { label: 'Page views', value: totals.pageViews.toLocaleString('en-LK') },
          {
            label: 'Bookings submitted',
            value: totals.bookings.toLocaleString('en-LK'),
            hint: 'Visitors who submitted a booking',
          },
          {
            label: 'Visit → booking',
            value: `${totals.conversionPct.toFixed(1)}%`,
            hint: 'Bookings ÷ visitors',
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle>Traffic</CardTitle>
            <span className="text-sm text-mute">Visitors, sessions and page views</span>
          </CardHeader>
          <CardBody>
            <TrafficChart data={trafficView} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="eyebrow">On the site now</p>
            <p className="mt-2 font-display text-5xl tabular-nums">
              <LiveCount initial={data.live} />
            </p>
            <p className="mt-2 text-xs text-mute">Sessions active in the last 5 minutes. Refreshes every 30 seconds.</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardBody>
            <BarList
              items={sources.map((source) => ({
                label: SOURCE_LABELS[source.source] ?? source.source,
                value: source.visitors,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
          </CardHeader>
          <CardBody>
            <BarList items={audience.devices.map((device) => ({ label: device.label, value: device.visitors }))} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel</CardTitle>
          <span className="text-sm text-mute">Visit → product view → cart → booking</span>
        </CardHeader>
        <CardBody>
          <FunnelChart steps={funnel} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <span className="text-sm text-mute">Views, adds to cart and bookings</span>
        </CardHeader>
        <CardBody className="p-0">
          {products.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH className="text-right">Views</TH>
                  <TH className="text-right">Added to cart</TH>
                  <TH className="text-right">Bookings</TH>
                </TR>
              </THead>
              <TBody>
                {products.map((product) => (
                  <TR key={product.productId}>
                    <TD>
                      {product.slug ? (
                        <Link href={`/product/${product.slug}/`} className="link-underline">
                          {product.name}
                        </Link>
                      ) : (
                        product.name
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{product.views.toLocaleString('en-LK')}</TD>
                    <TD className="text-right tabular-nums">{product.addsToCart.toLocaleString('en-LK')}</TD>
                    <TD className="text-right tabular-nums">{product.bookings.toLocaleString('en-LK')}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <NoData />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cities</CardTitle>
            <span className="text-sm text-mute">Top cities in Sri Lanka</span>
          </CardHeader>
          <CardBody>
            {audience.cities.length ? (
              <ol className="space-y-2 text-sm">
                {audience.cities.map((city, index) => (
                  <li
                    key={city.label}
                    className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2 last:border-0"
                  >
                    <span>
                      <span className="mr-2 tabular-nums text-mute">{index + 1}.</span>
                      {city.label}
                    </span>
                    <span className="tabular-nums text-mute">{city.visitors.toLocaleString('en-LK')} visitors</span>
                  </li>
                ))}
              </ol>
            ) : (
              <NoData />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chatbot</CardTitle>
            <span className="text-sm text-mute">Answers and knowledge gaps</span>
          </CardHeader>
          <CardBody>
            <ChatbotPanel stats={chatbot} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

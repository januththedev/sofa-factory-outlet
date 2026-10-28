import { Suspense } from 'react';
import { AdminPageError } from '@/components/admin/dashboard/page-error';
import { AdminPageLoading } from '@/components/admin/dashboard/page-loading';
import type { Metadata } from 'next';
import Link from 'next/link';
import { type Kpi } from '@/components/admin/dashboard/kpi-tiles';
import { KpiTiles } from '@/components/admin/dashboard/kpi-tiles';
import { formatCount } from '@/components/admin/dashboard/format';
import { formatShortDay } from '@/components/admin/dashboard/format';
import { formatToday } from '@/components/admin/dashboard/format';
import { RankedList } from '@/components/admin/dashboard/ranked-list';
import { SetupChecklistCard } from '@/components/admin/dashboard/setup-checklist-card';
import { UpcomingVisits } from '@/components/admin/dashboard/upcoming-visits';
import { VisitorsChart } from '@/components/admin/dashboard/visitors-chart';
import { PageHeader } from '@/components/admin/page-header';
import { BarList } from '@/components/admin/visitors/bar-list';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { buildSetupChecklist } from '@/lib/admin/setup-checklist';
import { openSetupItems } from '@/lib/admin/setup-checklist';
import { getDashboardStats } from '@/lib/admin/stats';
import { loadSetupInput } from '@/lib/admin/stats';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  visited: 'Visited',
  purchased: 'Purchased',
  lost: 'Lost',
  cancelled: 'Cancelled',
} as const;

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center text-base sm:text-sm font-medium text-maroon hover:underline"
    >
      {children}
    </Link>
  );
}

async function DashboardContent({ session }: { session: Awaited<ReturnType<typeof requireRole>> }) {
  // Staff and owners both see the dashboard; the setup checklist links to settings only the owner can open.
  const now = new Date();
  const loaded = await getDb().then(async (db) => {
    const [stats, setup] = await Promise.all([getDashboardStats(now, db), loadSetupInput(db)]);
    return { stats, setup };
  }).catch((error: unknown) => {
    console.error('[admin-dashboard] could not load the dashboard:', error);
    return null;
  });
  if (!loaded) return <AdminPageError />;
  const { stats, setup } = loaded;
  const checklist = buildSetupChecklist(setup);
  const { visitors, bookings, conversion } = stats;

  const chartData = visitors.series.map((day) => ({
    date: day.date,
    label: formatShortDay(day.date),
    visitors: day.visitors,
  }));
  const chartSummary =
    `Bar chart of visitors per day for the last 7 days: ` +
    chartData.map((day) => `${day.label}, ${formatCount(day.visitors)}`).join('; ') +
    '.';

  const kpis: Kpi[] = [
    {
      label: 'Visitors today',
      value: visitors.hasData ? formatCount(visitors.today) : null,
      hint: 'Distinct visitors since midnight, Sri Lanka time',
      href: '/admin/visitors/',
    },
    {
      label: 'Visitors, 7 days',
      value: visitors.hasData ? formatCount(visitors.last7) : null,
      hint: 'Each day counted separately',
      href: '/admin/visitors/',
    },
    {
      label: 'New bookings today',
      value: formatCount(bookings.newToday),
      hint: bookings.total === 0 ? 'No bookings yet' : `${formatCount(bookings.made7Days)} in the last 7 days`,
      href: '/admin/bookings/',
    },
    {
      label: 'Visits in the next 7 days',
      value: formatCount(bookings.next7Days),
      hint: 'New or contacted bookings',
      href: '/admin/bookings/',
    },
    {
      label: 'Visitor to booking',
      value: conversion.ratePct === null ? null : `${conversion.ratePct.toFixed(1)}%`,
      hint: `${formatCount(conversion.bookings)} bookings from ${formatCount(conversion.visitors)} visitors, 7 days`,
    },
    {
      label: 'Open knowledge gaps',
      value: formatCount(stats.openGaps),
      hint: 'Questions the chatbot could not answer',
      href: '/admin/knowledge/?tab=gaps',
    },
    {
      label: 'Unread notifications',
      value: formatCount(stats.unreadNotifications),
      hint: 'Open the bell at the top to read them',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${formatToday(now)}. Welcome back, ${session.name.split(' ')[0]}.`}
      />

      <KpiTiles items={[kpis[2], kpis[0], kpis[1], ...kpis.slice(3)]} />

      <SetupChecklistCard
        items={openSetupItems(checklist)}
        done={checklist.done}
        total={checklist.total}
        isOwner={session.role === 'owner'}
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="min-w-0">
          <CardHeader className="flex-wrap">
            <CardTitle>Visitors, last 7 days</CardTitle>
            <CardLink href="/admin/visitors/">Full report</CardLink>
          </CardHeader>
          <CardBody>
            <VisitorsChart data={chartData} summary={chartSummary} />
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex-wrap">
            <CardTitle>Bookings by status</CardTitle>
            <CardLink href="/admin/bookings/">All bookings</CardLink>
          </CardHeader>
          <CardBody>
            <BarList
              unit="bookings"
              emptyLabel="No bookings yet"
              items={(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>)
                .map((status) => ({ label: STATUS_LABELS[status], value: bookings.byStatus[status] }))
                .filter((item) => item.value > 0)}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="flex-wrap">
            <CardTitle>Upcoming visits</CardTitle>
            <CardLink href="/admin/bookings/calendar/">Calendar</CardLink>
          </CardHeader>
          <CardBody className="py-2">
            <UpcomingVisits visits={stats.upcoming} today={stats.today} />
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex-wrap">
            <CardTitle>Most viewed products</CardTitle>
            <span className="text-base sm:text-sm text-mute">Last 7 days</span>
          </CardHeader>
          <CardBody>
            <RankedList
              unit="views"
              items={stats.topProducts.map((product) => ({
                key: String(product.productId),
                label: product.name,
                count: product.views,
                href: `/admin/products/${product.productId}/`,
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader className="flex-wrap">
          <CardTitle>Top chatbot questions</CardTitle>
          <span className="text-base sm:text-sm text-mute">Last 30 days</span>
        </CardHeader>
        <CardBody>
          <RankedList
            unit="times"
            items={stats.topQuestions.map((question) => ({
              key: question.question,
              label: question.question,
              count: question.count,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireRole('any');
  return (
    <Suspense fallback={<AdminPageLoading label="dashboard" />}>
      <DashboardContent session={session} />
    </Suspense>
  );
}

import { OpsFrame } from '@/components/admin/settings/ops-frame';
import { PageHeader } from '@/components/admin/page-header';
import { OverviewTab } from '@/components/admin/seo/overview-tab';
import { ProductsTab } from '@/components/admin/seo/products-tab';
import { RedirectsTab } from '@/components/admin/seo/redirects-tab';
import { ReportTab } from '@/components/admin/seo/report-tab';
import { RequestsTab } from '@/components/admin/seo/requests-tab';
import { parseReviewStatus } from '@/components/admin/seo/reviews-tab';
import { ReviewsTab } from '@/components/admin/seo/reviews-tab';
import { parseSeoTab } from '@/components/admin/seo/tabs';
import { SeoTabs } from '@/components/admin/seo/tabs';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function SeoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireRole('any');
  const params = await searchParams;
  const tab = parseSeoTab(first(params.tab));

  return (
    <OpsFrame>
      <PageHeader
        title="SEO"
        description="How the site is doing in Google, which products need work, redirects and customer reviews."
      />
      <SeoTabs active={tab} />
      <div className="mt-6">
        {tab === 'overview' ? <OverviewTab /> : null}
        {tab === 'products' ? <ProductsTab /> : null}
        {tab === 'redirects' ? <RedirectsTab role={session.role} /> : null}
        {tab === 'reviews' ? (
          <ReviewsTab
            filter={{ status: parseReviewStatus(first(params.status)), verifiedOnly: first(params.verified) === '1' }}
          />
        ) : null}
        {tab === 'requests' ? <RequestsTab /> : null}
        {tab === 'report' ? <ReportTab month={first(params.month) ?? ''} /> : null}
      </div>
    </OpsFrame>
  );
}

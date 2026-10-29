import { OpsFrame } from '@/components/admin/settings/ops-frame';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { BusinessForm } from '@/components/admin/settings/business-form';
import { ChatSeoForm } from '@/components/admin/settings/chat-seo-form';
import { DeliveryProofForm } from '@/components/admin/settings/delivery-form';
import { HoursForm } from '@/components/admin/settings/hours-form';
import { InvoiceForm } from '@/components/admin/settings/invoice-form';
import { ServicesCard } from '@/components/admin/settings/services-card';
import { SettingsTabs } from '@/components/admin/settings/settings-tabs';
import { bpToPercent } from '@/lib/admin/settings';
import { readSettings } from '@/lib/admin/settings';
import { readSlots } from '@/lib/admin/settings';
import { getServiceStatus } from '@/lib/admin/stats';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

const TAB_IDS = ['business', 'hours', 'invoice', 'delivery', 'chat'] as const;
type TabId = (typeof TAB_IDS)[number];

const isTab = (value: string | undefined): value is TabId => TAB_IDS.some((id) => id === value);

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  // Settings are owner-only: staff are sent back to the dashboard.
  await requireRole('owner');
  const params = await searchParams;
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  if (requested === 'staff') redirect('/admin/admins/');
  const tab: TabId = isTab(requested) ? requested : 'business';

  const db = await getDb();
  const settings = await readSettings(db);
  const { business, hours, booking, invoice, delivery, proof, chat, seo } = settings;

  const unconfirmed = {
    business: [business.address, business.phone, business.whatsapp, business.email, business.map].some(
      (item) => !item.confirmed,
    ),
    hours: !hours.confirmed || !booking.confirmed,
    invoice: !invoice.confirmed,
    delivery: !delivery.confirmed || !proof.confirmed,
  };

  let content: React.ReactNode = null;
  if (tab === 'business') content = <BusinessForm business={business} />;
  if (tab === 'hours') content = <HoursForm hours={hours} booking={booking} slots={await readSlots(db)} />;
  if (tab === 'invoice') {
    const taxRatePercent = String(bpToPercent(invoice.taxRateBp));
    content = <InvoiceForm invoice={invoice} taxRatePercent={taxRatePercent} businessName={business.name} />;
  }
  if (tab === 'delivery') {
    content = (
      <div className="space-y-6">
        <DeliveryProofForm delivery={delivery} proof={proof} />
      </div>
    );
  }
  if (tab === 'chat') {
    content = (
      <div className="space-y-6">
        <ChatSeoForm chat={chat} seo={seo} />
        <ServicesCard services={getServiceStatus()} />
      </div>
    );
  }
  return (
    <OpsFrame>
      <PageHeader
        title="Settings"
        description={
          'Business details, hours, invoices and delivery. Details marked as a placeholder come from the old site ' +
          'and are not shown as fact on the public site until you confirm them.'
        }
      />
      <SettingsTabs
        active={tab}
        tabs={[
          { id: 'business', label: 'Business', unconfirmed: unconfirmed.business },
          { id: 'hours', label: 'Hours and visits', unconfirmed: unconfirmed.hours },
          { id: 'invoice', label: 'Invoices', unconfirmed: unconfirmed.invoice },
          { id: 'delivery', label: 'Delivery and proof', unconfirmed: unconfirmed.delivery },
          { id: 'chat', label: 'Chat and SEO' },
        ]}
      />
      {content}
    </OpsFrame>
  );
}

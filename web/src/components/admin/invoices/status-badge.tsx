import { Badge } from '@/components/ui/badge';
import { statusBadge } from '@/lib/admin/invoices';
import type { InvoiceStatus } from '@/lib/db/schema/types';

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const badge = statusBadge(status);
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

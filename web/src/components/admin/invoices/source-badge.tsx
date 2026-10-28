import { Badge } from '@/components/ui/badge';
import { sourceLabel } from '@/lib/admin/invoices';

export function SourceBadge({ source }: { source: 'website' | 'walk-in' }) {
  return <Badge tone={source === 'website' ? 'maroon' : 'neutral'}>{sourceLabel(source)}</Badge>;
}

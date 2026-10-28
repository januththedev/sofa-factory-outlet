'use client';

import { OpsError } from '@/components/admin/settings/ops-error';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <OpsError reset={reset} />;
}

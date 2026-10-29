import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import type { GscStatus } from '@/lib/seo/gsc';

/** Shown until Search Console is connected, and while the first rows are on their way. */
export function ConnectCard({ status }: { status: GscStatus }) {
  if (status.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Search Console is connected</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-base sm:text-sm text-ink-2">
          <p>
            Reading <strong className="font-semibold text-ink">{status.siteUrl}</strong> as {status.clientEmail}.
          </p>
          <p>
            No rows have arrived yet. The site pulls the last three days every night,
            and Google itself reports a day or
            two late, so the first numbers appear shortly after the first night.
          </p>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Google search numbers</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2 text-base sm:text-sm text-ink-2">
        <p>
          Ranking numbers from Google Search Console are optional and not connected, so this page shows the
          product checklist, redirects and reviews only. Nothing is sent to Google.
        </p>
        {status.problem ? (
          <p role="status" className="rounded-xl bg-warn/15 px-4 py-3 text-ink">
            {status.problem}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

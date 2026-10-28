import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import type { GscStatus } from '@/lib/seo/gsc';

const CODE = 'rounded bg-bone-2 px-1.5 py-0.5 text-xs';

/** Shown until Search Console is connected, and while the first rows are on their way. */
export function ConnectCard({ status }: { status: GscStatus }) {
  if (status.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Search Console is connected</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-ink-2">
          <p>
            Reading <strong className="font-semibold text-ink">{status.siteUrl}</strong> as {status.clientEmail}.
          </p>
          <p>
            No rows have arrived yet. The site pulls the last three days every night, and Google itself reports a day or
            two late, so the first numbers appear shortly after the first night.
          </p>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Search Console</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 text-sm text-ink-2">
        <p>
          Search Console shows which Google searches bring people to the site and where its pages rank. Until it is
          connected this page has no ranking numbers, but the product and review tabs work as normal.
        </p>
        {status.problem ? (
          <p role="status" className="rounded-xl bg-warn/15 px-4 py-3 text-ink">
            {status.problem}
          </p>
        ) : null}
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            In Google Search Console, add the website as a{' '}
            <strong className="font-semibold text-ink">Domain</strong> property and verify it by adding the DNS record
            Google gives you at the domain registrar.
          </li>
          <li>
            In Google Cloud, create a service account, switch on the Search Console API for the project and download
            the account&apos;s JSON key file.
          </li>
          <li>
            Back in Search Console, open Settings, then Users and permissions, and add the service account&apos;s email
            address as a user. Restricted access is enough.
          </li>
          <li>
            Set <code className={CODE}>GSC_SERVICE_ACCOUNT_JSON</code> to the key file encoded as base64, and{' '}
            <code className={CODE}>GSC_SITE_URL</code> to the property (for a domain property that is{' '}
            <code className="text-xs">sc-domain:</code> followed by the domain). Then redeploy.
          </li>
        </ol>
        <p className="text-mute">Nothing is sent to Google until both settings are present.</p>
      </CardBody>
    </Card>
  );
}

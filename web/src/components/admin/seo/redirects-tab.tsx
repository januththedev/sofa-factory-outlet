import { RedirectAddForm } from '@/components/admin/seo/redirect-forms';
import { RedirectRow } from '@/components/admin/seo/redirect-forms';
import { EmptyNote } from '@/components/admin/seo/ui';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import { listRedirects } from '@/lib/admin/seo';
import type { AdminRole } from '@/lib/db/schema/types';

export async function RedirectsTab({ role }: { role: AdminRole }) {
  const redirects = await listRedirects();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Add a redirect</CardTitle>
            <p className="mt-1 text-base sm:text-sm text-mute">
              Send an old address to a page that exists (301), or tell Google a page has gone for good (410). A new
              address cannot itself be redirected, so nobody is sent through two hops.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <RedirectAddForm />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Redirects</CardTitle>
            <p className="mt-1 text-base sm:text-sm text-mute">
              Most visited first. Redirects from hidden or renamed products are added automatically.
              {role === 'owner' ? '' : ' Only an owner can delete a redirect.'}
            </p>
          </div>
        </CardHeader>
        {redirects.length === 0 ? (
          <EmptyNote>There are no redirects yet.</EmptyNote>
        ) : (
          <Table>
            <caption className="sr-only">Every redirect with its destination, type, reason and visits</caption>
            <THead>
              <TR>
                <TH scope="col">From</TH>
                <TH scope="col">To</TH>
                <TH scope="col">Status</TH>
                <TH scope="col">Reason</TH>
                <TH scope="col" className="text-right">
                  Hits
                </TH>
                <TH scope="col">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {redirects.map((redirect) => (
                <RedirectRow key={redirect.id} redirect={redirect} canDelete={role === 'owner'} />
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

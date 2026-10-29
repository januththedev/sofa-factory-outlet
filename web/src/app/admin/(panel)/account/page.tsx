import type { Metadata } from 'next';
import { PasswordForm } from '@/components/admin/account/password-form';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { roleLabel } from '@/lib/auth/roles';
import { mustChangePassword, requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireRole('any');
  const mustChange = await mustChangePassword();
  return (
    <>
      <PageHeader title="My account" description={`${session.name} · ${session.email} · ${roleLabel(session.role)}`} />
      {mustChange ? (
        <p role="status" className="mb-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-base sm:text-sm">
          You signed in with a temporary password. Choose your own password to continue to the rest of the admin.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>
    </>
  );
}

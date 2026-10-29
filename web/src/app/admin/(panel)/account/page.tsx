import type { Metadata } from 'next';
import { PasswordForm } from '@/components/admin/account/password-form';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { roleLabel } from '@/lib/auth/roles';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireRole('any');
  return (
    <>
      <PageHeader title="My account" description={`${session.name} · ${session.email} · ${roleLabel(session.role)}`} />
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

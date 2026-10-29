import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { OpsFrame } from '@/components/admin/settings/ops-frame';
import { StaffManager, type StaffRowView } from '@/components/admin/settings/staff-manager';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listStaff } from '../settings/staff';

export const metadata: Metadata = { title: 'Admins' };
export const dynamic = 'force-dynamic';

const signInFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Colombo',
});

export default async function AdminsPage() {
  // Super admins only: every action behind this page also checks the role on the server.
  const session = await requireRole('owner');
  const members: StaffRowView[] = (await listStaff(await getDb())).map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    active: member.active,
    lastLoginLabel: member.lastLoginAt ? signInFormat.format(member.lastLoginAt) : 'never',
  }));
  return (
    <OpsFrame>
      <PageHeader
        title="Admins"
        description="Add people who can sign in to this admin. Only super admins can add, change or remove admins."
      />
      <StaffManager members={members} currentUserId={session.userId} />
    </OpsFrame>
  );
}

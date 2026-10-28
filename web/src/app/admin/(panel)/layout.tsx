import { AdminShell } from '@/components/admin/shell';
import { unreadBookingsCount } from '@/lib/auth/notifications';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// Every module page renders inside this shell. The layout checks the session so the
// shell can show who is signed in, but a layout's redirect does not stop the page
// below it from running: each page and action still calls requireRole() itself.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole();
  const unreadBookings = await unreadBookingsCount().catch(() => 0);
  return (
    <AdminShell user={{ name: session.name, email: session.email, role: session.role }} unreadBookings={unreadBookings}>
      {children}
    </AdminShell>
  );
}

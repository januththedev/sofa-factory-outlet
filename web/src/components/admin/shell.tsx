'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { Suspense, useState } from 'react';
import { NOTICE_PARAM, OWNER_ONLY_NOTICE } from '@/lib/auth/paths';
import { Sidebar, SidebarBrand, SidebarNav } from './sidebar';
import { Topbar } from './topbar';
import type { MenuUser } from './user-menu';

/** Shown after a staff account is turned away from an owner-only page (see requireRole). */
function FlashNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  if (params.get(NOTICE_PARAM) !== OWNER_ONLY_NOTICE) return null;

  const dismiss = () => {
    const rest = new URLSearchParams(params.toString());
    rest.delete(NOTICE_PARAM);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div role="status" className="mb-6 flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink">
      <p>That page is only open to the owner account.</p>
      <button type="button" onClick={dismiss} aria-label="Dismiss this notice" className="-m-1 rounded-full p-1 text-ink-2 hover:bg-warn/15">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Chrome for every admin page: a fixed sidebar from the lg breakpoint up (a
 * drawer below it), a sticky top bar with the notification bell and the account
 * menu, and the page itself in <main>.
 */
export function AdminShell({ user, unreadBookings, children }: { user: MenuUser; unreadBookings: number; children: React.ReactNode }) {
  const pathname = usePathname();
  // The drawer remembers the page it was opened on, so navigating closes it without an effect.
  const [drawer, setDrawer] = useState({ open: false, at: pathname });
  const drawerOpen = drawer.open && drawer.at === pathname;
  // The server gives the count at page load; the bell reports fresh ones as it polls.
  const [liveBookings, setLiveBookings] = useState<number | null>(null);
  const bookings = liveBookings ?? unreadBookings;

  return (
    <>
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh border-r border-line bg-paper lg:block">
          <Sidebar role={user.role} unreadBookings={bookings} />
        </aside>
        <div className="flex min-w-0 flex-col">
          <Topbar user={user} onOpenMenu={() => setDrawer({ open: true, at: pathname })} onBookings={setLiveBookings} />
          <main id="admin-main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1500px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
            <Suspense fallback={null}>
              <FlashNotice />
            </Suspense>
            {children}
          </main>
        </div>
      </div>

      <Dialog.Root open={drawerOpen} onOpenChange={(open) => setDrawer({ open, at: pathname })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-paper shadow-xl outline-none lg:hidden">
            <Dialog.Title className="sr-only">Admin menu</Dialog.Title>
            <div className="flex items-center justify-between pr-3">
              <SidebarBrand />
              <Dialog.Close asChild>
                <button type="button" aria-label="Close menu" className="flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-bone-2">
                  <X className="size-5" aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav role={user.role} unreadBookings={bookings} onNavigate={() => setDrawer({ open: false, at: pathname })} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

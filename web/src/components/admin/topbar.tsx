'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Bell } from './bell';
import { type MenuUser, UserMenu } from './user-menu';

const SECTION_TITLES: Array<[string, string]> = [
  ['/admin/bookings/calendar', 'Calendar'],
  ['/admin/bookings', 'Bookings'],
  ['/admin/leads', 'Leads'],
  ['/admin/customers', 'Customers'],
  ['/admin/products', 'Products'],
  ['/admin/categories', 'Categories'],
  ['/admin/knowledge', 'Knowledge'],
  ['/admin/chat', 'Chat'],
  ['/admin/visitors', 'Visitors'],
  ['/admin/invoices', 'Invoices'],
  ['/admin/seo', 'SEO'],
  ['/admin/settings', 'Settings'],
];

function pageTitle(pathname: string): string {
  return (
    SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ??
    'Dashboard'
  );
}

/** Compact admin chrome, with the current section visible beside the phone menu button. */
export function Topbar({
  user,
  onOpenMenu,
  onBookings,
}: {
  user: MenuUser;
  onOpenMenu: () => void;
  onBookings: (count: number) => void;
}) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-paper/95 px-3 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-bone-2 lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold lg:text-base">
        {pageTitle(pathname)}
      </p>
      <Bell onBookings={onBookings} />
      <UserMenu user={user} />
    </header>
  );
}

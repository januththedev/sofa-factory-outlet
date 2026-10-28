'use client';

import { Menu } from 'lucide-react';
import { Bell } from './bell';
import { type MenuUser, UserMenu } from './user-menu';

/** Sticky bar above every admin page: menu button (phones), a free area on the left, then the bell and the account menu. */
export function Topbar({ user, onOpenMenu, onBookings }: { user: MenuUser; onOpenMenu: () => void; onBookings: (count: number) => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-paper/90 px-4 backdrop-blur sm:gap-3 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-bone-2 lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1" />
      <Bell onBookings={onBookings} />
      <UserMenu user={user} />
    </header>
  );
}

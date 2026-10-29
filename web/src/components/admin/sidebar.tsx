'use client';

import {
  BookOpen,
  CalendarCheck,
  ChartColumn,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  ReceiptText,
  SearchCheck,
  Settings,
  Sofa,
  Tags,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { AdminRole } from '@/lib/db/schema/types';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  bookingsBadge?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products/', label: 'Products', icon: Sofa },
  { href: '/admin/categories/', label: 'Categories', icon: Tags },
  {
    href: '/admin/bookings/',
    label: 'Bookings',
    icon: CalendarCheck,
    bookingsBadge: true,
  },
  { href: '/admin/leads/', label: 'Leads', icon: MessagesSquare },
  { href: '/admin/customers/', label: 'Customers', icon: Users },
  { href: '/admin/knowledge/', label: 'Knowledge', icon: BookOpen },
  { href: '/admin/chat/', label: 'Chat', icon: MessagesSquare },
  { href: '/admin/visitors/', label: 'Visitors', icon: ChartColumn },
  { href: '/admin/invoices/', label: 'Invoices', icon: ReceiptText },
  { href: '/admin/seo/', label: 'SEO', icon: SearchCheck },
  { href: '/admin/admins/', label: 'Admins', icon: ShieldCheck, ownerOnly: true },
  {
    href: '/admin/settings/',
    label: 'Settings',
    icon: Settings,
    ownerOnly: true,
  },
];

/** The dashboard is active only on its own URL; other sections are active for their subtree. */
export function isActiveNav(pathname: string, href: string): boolean {
  if (href === '/admin/')
    return pathname === '/admin' || pathname === '/admin/';
  return pathname === href.slice(0, -1) || pathname.startsWith(href);
}

export function SidebarBrand() {
  return (
    <Link href="/admin/" className="flex min-h-14 items-center gap-3 px-5 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/mark.png"
        alt=""
        width={512}
        height={512}
        className="size-9"
      />
      <span>
        <span className="block text-sm font-semibold leading-tight">
          Sofa Factory Outlet
        </span>
        <span className="eyebrow">Admin</span>
      </span>
    </Link>
  );
}

export function SidebarNav({
  role,
  unreadBookings,
  onNavigate,
}: {
  role: AdminRole;
  unreadBookings: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="px-3 pb-6">
      <ul className="space-y-1">
        {NAV_ITEMS.filter((item) => !item.ownerOnly || role === 'owner').map(
          (item) => {
            const active = isActiveNav(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-maroon/10 text-maroon'
                      : 'text-ink-2 hover:bg-bone-2 hover:text-ink',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                  {item.bookingsBadge && unreadBookings > 0 ? (
                    <Badge tone="maroon" className="ml-auto">
                      {unreadBookings > 99 ? '99+' : unreadBookings}
                      <span className="sr-only"> new</span>
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}

/** The fixed column from lg up. Below that the shell shows the same nav in a drawer. */
export function Sidebar({
  role,
  unreadBookings,
}: {
  role: AdminRole;
  unreadBookings: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <SidebarBrand />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav role={role} unreadBookings={unreadBookings} />
      </div>
    </div>
  );
}

'use client';

import { ChevronDown, LogOut } from 'lucide-react';
import { Popover } from 'radix-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/lib/auth/actions';
import type { AdminRole } from '@/lib/db/schema/types';

export type MenuUser = { name: string; email: string; role: AdminRole };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || '?';

export function UserMenu({ user }: { user: MenuUser }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-full border border-line bg-paper p-1 text-sm font-medium transition-colors hover:bg-bone-2 sm:pr-3"
        >
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-maroon text-xs font-semibold text-bone"
          >
            {initials(user.name)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
          <ChevronDown className="hidden size-4 text-mute sm:block" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label="Account"
          className="z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-card)] border border-line bg-paper p-4 shadow-xl"
        >
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-sm text-mute">{user.email}</p>
          <Badge tone={user.role === 'owner' ? 'maroon' : 'neutral'} className="mt-2 capitalize">
            {user.role}
          </Badge>
          <form action={signOutAction} className="mt-4 border-t border-line pt-4">
            <Button type="submit" variant="ghost" className="w-full">
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

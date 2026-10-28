'use client';

import { CircleCheck } from 'lucide-react';
import { EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import type { SetupGroup } from '@/lib/admin/setup-checklist';
import type { SetupItem } from '@/lib/admin/setup-checklist';

const STORAGE_KEY = 'sfo-admin-setup-hidden';
const CHANGE_EVENT = 'sfo-admin-setup-hidden-change';
const SHOWN_AT_FIRST = 5;

const GROUP_LABELS: Record<SetupGroup, string> = {
  details: 'Business details',
  terms: 'Terms',
  catalogue: 'Catalogue',
  services: 'Services',
};

// "Hide for now" only collapses an item on this browser. It is still counted and listed under
// "Hidden for now", and it leaves for good only when the setting or data behind it is fixed.
// If storage is blocked the choice lasts until the page is reloaded.
let memory = '';

function readHidden(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return memory;
  }
}

function writeHidden(ids: string[]) {
  memory = JSON.stringify(ids);
  try {
    window.localStorage.setItem(STORAGE_KEY, memory);
  } catch {
    // Storage is blocked; the in-memory copy still serves this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function parseHidden(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

type ItemRowProps = { item: SetupItem; hidden: boolean; canOpen: boolean; onToggle: () => void };

function ItemRow({ item, hidden, canOpen, onToggle }: ItemRowProps) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {item.label}
          <Badge tone="neutral">{GROUP_LABELS[item.group]}</Badge>
        </p>
        {hidden ? null : <p className="mt-0.5 text-base sm:text-sm text-mute">{item.detail}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canOpen ? (
          <Link href={item.href} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            {hidden ? 'Open' : 'Fix this'}
            <span className="sr-only">: {item.label}</span>
          </Link>
        ) : (
          <Badge tone="neutral">Ask the owner</Badge>
        )}
        <Button size="sm" variant="subtle" onClick={onToggle}>
          {hidden ? 'Show again' : 'Hide for now'}
          <span className="sr-only">: {item.label}</span>
        </Button>
      </div>
    </li>
  );
}

/**
 * What the client still has to confirm, derived from the settings and data, so an item
 * disappears by itself once it is fixed. Open items are listed with a link to the fix.
 */
type CardProps = {
  items: SetupItem[];
  done: number;
  total: number;
  /** Settings pages are owner-only, so staff see what is open but are not sent there. */
  isOwner: boolean;
};

export function SetupChecklistCard({ items, done, total, isOwner }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const canOpen = (item: SetupItem) => isOwner || !item.href.startsWith('/admin/settings/');
  const raw = useSyncExternalStore(subscribe, readHidden, () => '');
  const hiddenIds = new Set(parseHidden(raw));
  const shown = items.filter((item) => !hiddenIds.has(item.id));
  const hidden = items.filter((item) => hiddenIds.has(item.id));
  const toggle = (id: string) => {
    const next = new Set(hiddenIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Only ids still open are kept, so the list cannot grow with items that were fixed long ago.
    writeHidden(items.filter((item) => next.has(item.id)).map((item) => item.id));
  };

  if (items.length === 0) {
    return (
      <Card className="min-w-0">
        <CardBody className="flex items-center gap-3">
          <CircleCheck className="size-5 shrink-0 text-good" aria-hidden />
          <p className="text-base sm:text-sm">All {total} setup items are done. Nothing is waiting on the client.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-warn/40">
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle>Setup checklist</CardTitle>
          <p className="mt-1 text-base sm:text-sm text-mute">
            {done} of {total} done. These are still placeholders or missing, so the public site holds them back.
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Setup items done"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mt-2 h-2 w-28 shrink-0 overflow-hidden rounded-full bg-bone-2"
        >
          <div className="h-2 rounded-full bg-good" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      </CardHeader>
      <div className="px-4 py-3 lg:hidden">
        <Button
          variant="subtle"
          className="w-full"
          aria-expanded={expanded}
          aria-controls="setup-items"
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? 'Hide setup checklist' : `Show setup checklist (${items.length} remaining)`}
        </Button>
      </div>
      <CardBody id="setup-items" className={expanded ? 'space-y-3 py-3' : 'hidden space-y-3 py-3 lg:block'}>
        {shown.length > 0 ? (
          <ul className="divide-y divide-line">
            {shown.slice(0, SHOWN_AT_FIRST).map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                hidden={false}
                canOpen={canOpen(item)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-base sm:text-sm text-mute">Every open item is hidden for now.</p>
        )}
        {shown.length > SHOWN_AT_FIRST ? (
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-base sm:text-sm font-medium text-maroon">
              Show {shown.length - SHOWN_AT_FIRST} more
            </summary>
            <ul className="divide-y divide-line">
              {shown.slice(SHOWN_AT_FIRST).map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  hidden={false}
                  canOpen={canOpen(item)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </ul>
          </details>
        ) : null}
        {hidden.length > 0 ? (
          <details className="rounded-xl bg-bone-2/60 px-4 py-2">
            <summary className="flex min-h-11 cursor-pointer py-3 items-center gap-2 text-base sm:text-sm font-medium">
              <EyeOff className="size-4" aria-hidden />
              Hidden for now ({hidden.length})
            </summary>
            <ul className="divide-y divide-line">
              {hidden.map((item) => (
                <ItemRow key={item.id} item={item} hidden canOpen={canOpen(item)} onToggle={() => toggle(item.id)} />
              ))}
            </ul>
          </details>
        ) : null}
      </CardBody>
    </Card>
  );
}

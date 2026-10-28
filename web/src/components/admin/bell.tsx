'use client';

import { Bell as BellGlyph, BellRing, CalendarCheck, CheckCheck, Flag, Headset, Info, Lightbulb, type LucideIcon, Newspaper, ReceiptText, Star, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Popover } from 'radix-ui';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import type { BellItem, BellPayload } from '@/lib/auth/notifications';
import { safeAdminPath } from '@/lib/auth/paths';

const ENDPOINT = '/api/admin/notifications/';
const POLL_MS = 20_000;
const SOUND_KEY = 'sfo-admin-bell-sound';
const DESKTOP_KEY = 'sfo-admin-bell-desktop';
const FLAG_EVENT = 'sfo-admin-bell-flags';

const TYPE_ICONS: Record<BellItem['type'], LucideIcon> = {
  booking: CalendarCheck,
  handoff: Headset,
  knowledge_gap: Lightbulb,
  flagged_answer: Flag,
  overdue_invoice: ReceiptText,
  digest: Newspaper,
  review: Star,
  system: Info,
};

type Flags = { sound: boolean; desktop: boolean };
type BellState = { payload: BellPayload | null; at: number; signedOut: boolean };

// ---- the sound / desktop-alert choices live in localStorage, read through a store so no effect has to set state ----

function subscribeToFlags(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(FLAG_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(FLAG_EVENT, callback);
  };
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false; // storage blocked (private mode): the choice just does not stick
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // see readFlag
  }
  window.dispatchEvent(new Event(FLAG_EVENT));
}

function useStoredFlag(key: string): boolean {
  return useSyncExternalStore(subscribeToFlags, () => readFlag(key), () => false);
}

// ---- helpers ----

function isPayload(value: unknown): value is BellPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BellPayload>;
  return typeof candidate.unread === 'number' && typeof candidate.unreadBookings === 'number' && Array.isArray(candidate.items);
}

function relativeTime(iso: string, now: number): string {
  const seconds = Math.round((now - Date.parse(iso)) / 1000);
  if (Number.isNaN(seconds)) return '';
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function beep() {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => void context.close();
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  } catch {
    // no audio available
  }
}

/** Plays the chime and/or raises browser notifications for notifications that arrived since the last poll. */
function alertFor(fresh: BellItem[], flags: Flags) {
  if (flags.sound) beep();
  if (!flags.desktop || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const item of fresh.slice(0, 3)) {
    try {
      const popup = new Notification(item.title, { body: item.body ?? undefined, tag: `sfo-notification-${item.id}` });
      const target = item.link ? safeAdminPath(item.link) : null;
      popup.onclick = () => {
        window.focus();
        popup.close();
        if (target) window.location.assign(target);
      };
    } catch {
      // some browsers only allow notifications from a service worker
    }
  }
}

// ---- the bell ----

export function Bell({ onBookings }: { onBookings?: (count: number) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BellState>({ payload: null, at: 0, signedOut: false });
  const [hint, setHint] = useState<string | null>(null);
  const sound = useStoredFlag(SOUND_KEY);
  const desktop = useStoredFlag(DESKTOP_KEY);

  // Latest values for the poller and its callbacks, which must not restart whenever they change.
  const flags = useRef<Flags>({ sound, desktop });
  const onBookingsRef = useRef(onBookings);
  const highestSeen = useRef<number | null>(null);
  useEffect(() => {
    flags.current = { sound, desktop };
    onBookingsRef.current = onBookings;
  });

  const apply = useCallback((payload: BellPayload) => {
    const previous = highestSeen.current;
    highestSeen.current = payload.items.reduce((highest, item) => Math.max(highest, item.id), previous ?? 0);
    setState({ payload, at: Date.now(), signedOut: false });
    onBookingsRef.current?.(payload.unreadBookings);
    // The first load only sets the baseline; after that anything newer and unread is "new".
    if (previous !== null) {
      const fresh = payload.items.filter((item) => !item.read && item.id > previous);
      if (fresh.length > 0) alertFor(fresh, flags.current);
    }
  }, []);

  // Poll every 20 seconds, pause while the tab is hidden (unless desktop alerts are on,
  // which only matter when it is hidden) and catch up as soon as it is visible again.
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const poll = async () => {
      if (stopped || (document.hidden && !flags.current.desktop)) return;
      try {
        const response = await fetch(ENDPOINT, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } });
        if (response.status === 401 || response.status === 403 || response.redirected) {
          stopped = true; // signed out: the next admin page load goes to the login page
          setState((current) => ({ ...current, signedOut: true }));
          return;
        }
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (isPayload(data)) apply(data);
      } catch {
        // offline or aborted: the next tick tries again
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [apply]);

  const send = useCallback(
    async (ids?: number[]) => {
      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(ids ? { ids } : {}),
        });
        if (response.status === 401) {
          setState((current) => ({ ...current, signedOut: true }));
          return;
        }
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (isPayload(data)) apply(data);
      } catch {
        // the next poll corrects the numbers
      }
    },
    [apply],
  );

  const payload = state.payload;
  const unread = payload?.unread ?? 0;

  const showRead = (match: (item: BellItem) => boolean) => {
    if (!payload) return;
    const flipped = payload.items.filter((item) => !item.read && match(item));
    const next: BellPayload = {
      unread: Math.max(0, payload.unread - flipped.length),
      unreadBookings: Math.max(0, payload.unreadBookings - flipped.filter((item) => item.type === 'booking').length),
      items: payload.items.map((item) => (!item.read && match(item) ? { ...item, read: true } : item)),
    };
    setState({ ...state, payload: next });
    onBookings?.(next.unreadBookings);
  };

  const openItem = (item: BellItem) => {
    setOpen(false);
    if (!item.read) {
      showRead((candidate) => candidate.id === item.id);
      void send([item.id]);
    }
    const target = item.link ? safeAdminPath(item.link) : null;
    if (target) router.push(target);
  };

  const markAll = () => {
    if (payload) {
      setState({ ...state, payload: { unread: 0, unreadBookings: 0, items: payload.items.map((item) => ({ ...item, read: true })) } });
      onBookings?.(0);
    }
    void send();
  };

  const toggleSound = () => {
    writeFlag(SOUND_KEY, !sound);
    if (!sound) beep(); // a click is the user gesture that lets the browser play sound; this also previews it
  };

  const toggleDesktop = async () => {
    if (desktop) {
      writeFlag(DESKTOP_KEY, false);
      setHint(null);
      return;
    }
    if (typeof Notification === 'undefined') {
      setHint('This browser cannot show desktop alerts.');
      return;
    }
    // Permission is only ever requested here, from a click.
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    writeFlag(DESKTOP_KEY, permission === 'granted');
    setHint(permission === 'granted' ? null : 'Desktop alerts are blocked in your browser settings.');
  };

  const toggleClass = (on: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
      on ? 'border-maroon bg-maroon/10 text-maroon' : 'border-line text-ink-2 hover:bg-bone-2',
    );

  return (
    <>
    <span role="status" className="sr-only">
      {unread > 0 ? `${unread} unread notifications` : ''}
    </span>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-bone-2"
        >
          <BellGlyph className="size-5" aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 flex min-w-[1.125rem] items-center justify-center rounded-full bg-maroon px-1 text-[0.65rem] font-semibold leading-[1.125rem] text-bone"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label="Notifications"
          className="z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="font-display text-lg">Notifications</p>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-maroon transition-colors hover:bg-maroon/10 disabled:pointer-events-none disabled:opacity-40"
            >
              <CheckCheck className="size-4" aria-hidden />
              Mark all read
            </button>
          </div>

          {state.signedOut ? (
            <p className="px-4 py-6 text-sm text-ink-2">
              You have been signed out. <Link href="/admin/login/" className="font-semibold text-maroon underline underline-offset-4">Sign in again</Link> to see notifications.
            </p>
          ) : !payload ? (
            <p className="px-4 py-6 text-sm text-mute">Loading…</p>
          ) : payload.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-mute">Nothing yet. New bookings, chat hand-offs and alerts appear here.</p>
          ) : (
            <ul className="max-h-[min(24rem,60vh)] divide-y divide-line overflow-y-auto">
              {payload.items.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? Info;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bone-2', !item.read && 'bg-maroon/[0.04]')}
                    >
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', item.read ? 'bg-bone-2 text-mute' : 'bg-maroon/10 text-maroon')}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', item.read ? 'text-ink-2' : 'font-semibold text-ink')}>{item.title}</span>
                        {item.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-mute">{item.body}</span> : null}
                        <span className="mt-1 block text-xs text-mute">{relativeTime(item.createdAt, state.at)}</span>
                      </span>
                      {!item.read ? (
                        <>
                          <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-maroon" />
                          <span className="sr-only">Unread</span>
                        </>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <button type="button" aria-pressed={sound} onClick={toggleSound} className={toggleClass(sound)}>
              {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
              Sound
            </button>
            <button type="button" aria-pressed={desktop} onClick={() => void toggleDesktop()} className={toggleClass(desktop)}>
              <BellRing className="size-4" aria-hidden />
              Desktop alerts
            </button>
          </div>
          {hint ? (
            <p role="status" className="px-4 pb-3 text-xs text-mute">
              {hint}
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    </>
  );
}

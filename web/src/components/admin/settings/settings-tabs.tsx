import Link from 'next/link';
import { cn } from '@/lib/cn';

export type SettingsTab = { id: string; label: string; unconfirmed?: boolean };

/** Section links. Plain links with ?tab=, so each section is a page of its own and works without scripts. */
export function SettingsTabs({ tabs, active }: { tabs: SettingsTab[]; active: string }) {
  return (
    <nav aria-label="Settings sections" className="mb-6 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={`/admin/settings/?tab=${tab.id}`}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  '-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  current ? 'border-maroon text-maroon' : 'border-transparent text-ink-2 hover:text-ink',
                )}
              >
                {tab.label}
                {tab.unconfirmed ? (
                  <>
                    <span aria-hidden className="size-2 rounded-full bg-warn" />
                    <span className="sr-only">(has details still to confirm)</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

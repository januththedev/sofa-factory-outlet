import { ScrollTabs } from '@/components/admin/settings/scroll-tabs';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export const CHAT_TABS = [
  { id: 'conversations', label: 'Conversations', ownerOnly: false },
  { id: 'playground', label: 'Playground', ownerOnly: false },
  { id: 'golden', label: 'Golden test', ownerOnly: false },
  { id: 'settings', label: 'Settings', ownerOnly: true },
] as const;

export type ChatTab = (typeof CHAT_TABS)[number]['id'];

export function parseChatTab(value: string | undefined): ChatTab {
  return CHAT_TABS.find((tab) => tab.id === value)?.id ?? 'conversations';
}

/** Tab links for the Chat page. Settings is only listed for the owner. */
export function ChatTabs({ active, owner }: { active: ChatTab; owner: boolean }) {
  return (
    <ScrollTabs active={active}>
    <nav aria-label="Chat sections" className="mb-6 flex gap-2 min-w-max border-b border-line">
      {CHAT_TABS.filter((tab) => owner || !tab.ownerOnly).map((tab) => (
        <Link
          key={tab.id}
          href={`/admin/chat/?tab=${tab.id}`}
          aria-current={tab.id === active ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap border-b-2 px-4 py-3 text-base sm:text-sm font-semibold',
            tab.id === active ? 'border-maroon text-maroon' : 'border-transparent text-mute hover:text-ink',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
    </ScrollTabs>
  );
}

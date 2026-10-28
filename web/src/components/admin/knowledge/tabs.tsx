import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

export const KNOWLEDGE_TABS = [
  { id: 'documents', label: 'Documents' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'synonyms', label: 'Synonyms' },
  { id: 'gaps', label: 'Gaps' },
] as const;

export type KnowledgeTab = (typeof KNOWLEDGE_TABS)[number]['id'];

export function parseKnowledgeTab(value: string | undefined): KnowledgeTab {
  return KNOWLEDGE_TABS.find((tab) => tab.id === value)?.id ?? 'documents';
}

/** Tab links for the Knowledge base page. The Gaps tab shows how many questions are waiting for an answer. */
export function KnowledgeTabs({ active, openGaps }: { active: KnowledgeTab; openGaps: number }) {
  return (
    <nav aria-label="Knowledge base sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {KNOWLEDGE_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/admin/knowledge/?tab=${tab.id}`}
          aria-current={tab.id === active ? 'page' : undefined}
          className={cn(
            'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold',
            tab.id === active ? 'border-maroon text-maroon' : 'border-transparent text-mute hover:text-ink',
          )}
        >
          {tab.label}
          {tab.id === 'gaps' && openGaps > 0 ? <Badge tone="warn">{openGaps}</Badge> : null}
        </Link>
      ))}
    </nav>
  );
}

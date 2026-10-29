import type { Metadata } from 'next';
import { OpsFrame } from '@/components/admin/settings/ops-frame';
import Link from 'next/link';
import { ConversationDetailView } from '@/components/admin/chat/conversation-detail';
import { ConversationsPanel } from '@/components/admin/chat/conversations-panel';
import { parseConversationFilter } from '@/components/admin/chat/conversations-panel';
import { GoldenRunner } from '@/components/admin/chat/golden-runner';
import { Playground } from '@/components/admin/chat/playground';
import { SettingsForm } from '@/components/admin/chat/settings-form';
import { ChatTabs } from '@/components/admin/chat/tabs';
import { parseChatTab } from '@/components/admin/chat/tabs';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { chatSettingsView } from '@/lib/admin/chat';
import { conversationCounts } from '@/lib/admin/chat';
import { getConversation } from '@/lib/admin/chat';
import { readLastEval } from '@/lib/admin/knowledge';
import { toEvalView } from '@/lib/admin/knowledge';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Chat' };

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ tab?: string; filter?: string; page?: string; c?: string }>;
};

function positiveInt(value: string | undefined): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function GoldenTab() {
  const last = await readLastEval();
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Golden test</CardTitle>
          <p className="mt-1 text-base sm:text-sm text-mute">
            A fixed set of real customer questions with the answer each should find. Run it after every knowledge
            change: it shows whether the bot now finds the right facts more or less often.
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <GoldenRunner initial={last ? toEvalView(last) : null} showFailures />
      </CardBody>
    </Card>
  );
}

async function ConversationsTab({ params }: { params: Awaited<Props['searchParams']> }) {
  const filter = parseConversationFilter(params.filter);
  const page = positiveInt(params.page) ?? 1;
  const listHref = `/admin/chat/?tab=conversations&filter=${filter}&page=${page}`;
  const id = positiveInt(params.c);
  if (id !== null) {
    const detail = await getConversation(id);
    if (detail) return <ConversationDetailView detail={detail} backHref={listHref} />;
  }
  const counts = await conversationCounts();
  return (
    <div className="space-y-4">
      {id !== null ? (
        <p role="alert" className="rounded-xl bg-warn/15 px-4 py-3 text-base sm:text-sm">
          That conversation no longer exists.
        </p>
      ) : null}
      {counts.handoff > 0 && filter !== 'handoff' ? (
        <p className="rounded-xl bg-warn/15 px-4 py-3 text-base sm:text-sm">
          {counts.handoff} {counts.handoff === 1 ? 'conversation asked' : 'conversations asked'} for a person.{' '}
          <Link
            href="/admin/chat/?tab=conversations&filter=handoff"
            className="font-semibold text-maroon underline-offset-4 hover:underline"
          >
            Show them
          </Link>
        </p>
      ) : null}
      <ConversationsPanel filter={filter} page={page} counts={counts} />
    </div>
  );
}

export default async function ChatPage({ searchParams }: Props) {
  const session = await requireRole('any');
  const params = await searchParams;
  const tab = parseChatTab(params.tab);
  // Settings change how the whole bot behaves and what it can cost, so staff are sent back to the dashboard.
  if (tab === 'settings') await requireRole('owner');
  return (
    <OpsFrame>
      <PageHeader
        title="Chat"
        description="Read conversations, try questions, check relevance and set the limits for the chatbot."
      />
      <ChatTabs active={tab} owner={session.role === 'owner'} />
      {tab === 'conversations' ? <ConversationsTab params={params} /> : null}
      {tab === 'playground' ? <Playground /> : null}
      {tab === 'golden' ? <GoldenTab /> : null}
      {tab === 'settings' ? <SettingsForm view={await chatSettingsView()} /> : null}
    </OpsFrame>
  );
}

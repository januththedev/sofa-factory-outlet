import { OpsFrame } from '@/components/admin/settings/ops-frame';
import { PageHeader } from '@/components/admin/page-header';
import { DocumentsPanel } from '@/components/admin/knowledge/documents-panel';
import { FaqsPanel } from '@/components/admin/knowledge/faqs-panel';
import { GapsPanel } from '@/components/admin/knowledge/gaps-panel';
import { parseGapSort } from '@/components/admin/knowledge/gaps-panel';
import { parseGapStatus } from '@/components/admin/knowledge/gaps-panel';
import { SynonymsPanel } from '@/components/admin/knowledge/synonyms-panel';
import { KnowledgeTabs } from '@/components/admin/knowledge/tabs';
import { parseKnowledgeTab } from '@/components/admin/knowledge/tabs';
import { countOpenGaps } from '@/lib/admin/knowledge';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    tab?: string;
    doc?: string;
    view?: string;
    q?: string;
    page?: string;
    status?: string;
    sort?: string;
  }>;
};

function pageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default async function KnowledgePage({ searchParams }: Props) {
  const session = await requireRole('any');
  const params = await searchParams;
  const tab = parseKnowledgeTab(params.tab);
  const openGaps = await countOpenGaps().catch(() => 0);
  return (
    <OpsFrame>
      <PageHeader
        title="Knowledge base"
        description="What the chatbot knows: documents, FAQs, customer wording and questions it could not answer."
      />
      <KnowledgeTabs active={tab} openGaps={openGaps} />
      {tab === 'documents' ? (
        <DocumentsPanel doc={params.doc} view={params.view} owner={session.role === 'owner'} />
      ) : null}
      {tab === 'faqs' ? <FaqsPanel q={params.q?.trim().slice(0, 200) ?? ''} page={pageNumber(params.page)} /> : null}
      {tab === 'synonyms' ? <SynonymsPanel /> : null}
      {tab === 'gaps' ? <GapsPanel status={parseGapStatus(params.status)} sort={parseGapSort(params.sort)} /> : null}
    </OpsFrame>
  );
}

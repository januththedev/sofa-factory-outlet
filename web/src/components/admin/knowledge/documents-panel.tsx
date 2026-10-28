import Link from 'next/link';
import { readChatSettings } from '@/lib/admin/chat';
import type { DocumentSummary } from '@/lib/admin/knowledge';
import { formatWhen } from '@/lib/admin/knowledge';
import { getCurrentDocument } from '@/lib/admin/knowledge';
import { listChunks } from '@/lib/admin/knowledge';
import { listDocuments } from '@/lib/admin/knowledge';
import { listVersions } from '@/lib/admin/knowledge';
import { MAX_UPLOAD_BYTES } from '@/lib/admin/knowledge';
import { readLastEval } from '@/lib/admin/knowledge';
import { readStoredText } from '@/lib/admin/knowledge';
import { toEvalView } from '@/lib/admin/knowledge';
import { env } from '@/lib/env';
import { hasOpenRouter } from '@/lib/env';
import { isPglite } from '@/lib/env';
import { GoldenRunner } from '@/components/admin/chat/golden-runner';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TD } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import { ChunkPreview } from './chunk-preview';
import { DocumentEditor } from './document-editor';
import { DocumentSwitch } from './document-switch';
import { EmbeddingsCard } from './embeddings-card';
import { UploadPanel } from './upload-panel';
import { VersionHistory } from './version-history';

type View = 'chunks' | 'history' | 'edit';

const parseView = (value: string | undefined): View | null =>
  value === 'chunks' || value === 'history' || value === 'edit' ? value : null;

const detailHref = (slug: string, view: View) =>
  `/admin/knowledge/?tab=documents&doc=${encodeURIComponent(slug)}&view=${view}#doc-detail`;

const linkClass = 'inline-flex min-h-11 min-w-11 items-center text-maroon underline-offset-4 hover:underline';

function DocumentRow({ doc }: { doc: DocumentSummary }) {
  return (
    <TR>
      <TD>
        <p className="font-semibold">{doc.title}</p>
        <p className="font-mono text-xs text-mute">{doc.slug}</p>
        {doc.editedInAdmin ? (
          <Badge tone="warn" className="mt-1">
            Edited in admin
          </Badge>
        ) : null}
      </TD>
      <TD>
        <Badge tone="neutral">{doc.kind}</Badge>
      </TD>
      <TD>v{doc.version}</TD>
      <TD className="hidden md:table-cell">
        <div className="flex flex-wrap gap-1">
          {doc.tags.length > 0 ? (
            doc.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)
          ) : (
            <span className="text-mute">none</span>
          )}
        </div>
      </TD>
      <TD className="hidden md:table-cell">
        <Badge tone={doc.priority === 'high' ? 'maroon' : 'neutral'}>{doc.priority}</Badge>
      </TD>
      <TD>
        <DocumentSwitch key={doc.id} id={doc.id} title={doc.title} enabled={doc.enabled} />
      </TD>
      <TD>{doc.chunkCount}</TD>
      <TD className="hidden whitespace-nowrap lg:table-cell">{formatWhen(doc.updatedAt)}</TD>
      <TD className="hidden lg:table-cell">{doc.source === 'starter' ? 'Starter' : 'Upload'}</TD>
      <TD>
        <div className="flex flex-wrap gap-2 text-base sm:text-sm">
          <Link href={detailHref(doc.slug, 'chunks')} className={linkClass}>
            Chunks
          </Link>
          <Link href={detailHref(doc.slug, 'history')} className={linkClass}>
            History ({doc.versionCount})
          </Link>
          <Link href={detailHref(doc.slug, 'edit')} className={linkClass}>
            Edit
          </Link>
        </div>
      </TD>
    </TR>
  );
}

async function Detail({ doc, view }: { doc: DocumentSummary; view: View }) {
  const lastEval = await readLastEval();
  const evalView = lastEval ? toEvalView(lastEval) : null;
  const titles = { chunks: 'Chunks the bot reads now', history: 'Version history', edit: 'Edit in the browser' };
  let body: React.ReactNode = null;
  if (view === 'chunks') {
    body = <ChunkPreview chunks={await listChunks(doc.id)} title={`Version ${doc.version}`} />;
  } else if (view === 'history') {
    const versions = await listVersions(doc.slug);
    body = (
      <VersionHistory
        slug={doc.slug}
        lastEval={evalView}
        rows={versions.map((version) => ({
          id: version.id,
          version: version.version,
          isCurrent: version.isCurrent,
          source: version.source,
          savedLabel: formatWhen(version.createdAt),
          chunkCount: version.chunkCount,
          hasFile: version.hasFile,
        }))}
      />
    );
  } else {
    const current = await getCurrentDocument(doc.slug);
    const text = current ? await readStoredText(current.fileKey) : null;
    body = <DocumentEditor key={`${doc.id}`} slug={doc.slug} kind={doc.kind} initialText={text} lastEval={evalView} />;
  }
  return (
    <Card>
      <CardHeader>
        <div id="doc-detail" className="scroll-mt-24">
          <CardTitle>
            {titles[view]}: {doc.title}
          </CardTitle>
          <p className="mt-1 text-base sm:text-sm text-mute">
            <Link href="/admin/knowledge/?tab=documents" className={linkClass}>
              Close
            </Link>
          </p>
        </div>
      </CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
  );
}

/** The Documents tab: golden test, upload, the document list and the owner-only embeddings card. */
export async function DocumentsPanel({
  doc,
  view,
  owner,
}: {
  doc: string | undefined;
  view: string | undefined;
  owner: boolean;
}) {
  const [documents, lastEval] = await Promise.all([listDocuments(), readLastEval()]);
  const evalView = lastEval ? toEvalView(lastEval) : null;
  const selected = documents.find((item) => item.slug === doc) ?? null;
  const selectedView = parseView(view);
  const chat = owner ? await readChatSettings() : null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Golden test</CardTitle>
            <p className="mt-1 text-base sm:text-sm text-mute">
              Run it after every change to see whether the bot finds the right facts more or less often.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <GoldenRunner initial={evalView} />
        </CardBody>
      </Card>
      <UploadPanel maxBytes={MAX_UPLOAD_BYTES} lastEval={evalView} />
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        {documents.length === 0 ? (
          <CardBody>
            <p className="text-base sm:text-sm text-mute">
              No documents yet. Upload a file above, or the starter pack loads when the site first starts.
            </p>
          </CardBody>
        ) : (
          <>
          <ul className="grid gap-3 p-3 lg:hidden">
            {documents.map((item) => (
              <li key={item.id} className="min-w-0 space-y-3 rounded-xl border border-line p-4">
                <p className="font-semibold">{item.title}</p>
                <p
                  className="break-all text-base sm:text-sm text-mute">
                  {item.slug} · {item.kind} · Version {item.version}
                </p>
                <p>{item.chunkCount} chunks · {formatWhen(item.updatedAt)}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <span>Use in chat</span>
                  <DocumentSwitch id={item.id} title={item.title} enabled={item.enabled} />
                </div>
                <nav aria-label={`Open ${item.title}`} className="flex flex-wrap gap-2">
                  <Link className={linkClass} href={detailHref(item.slug, 'chunks')}>Chunks</Link>
                  <Link className={linkClass} href={detailHref(item.slug, 'history')}>
                    History ({item.versionCount})
                  </Link>
                  <Link className={linkClass} href={detailHref(item.slug, 'edit')}>Edit</Link>
                </nav>
              </li>
            ))}
          </ul>
          <div className="hidden min-w-0 lg:block">
          <Table>
            <THead>
              <TR>
                <TH>Document</TH>
                <TH>Type</TH>
                <TH>Version</TH>
                <TH className="hidden md:table-cell">Tags</TH>
                <TH className="hidden md:table-cell">Priority</TH>
                <TH>Use in chat</TH>
                <TH>Chunks</TH>
                <TH className="hidden lg:table-cell">Updated</TH>
                <TH className="hidden lg:table-cell">Source</TH>
                <TH>
                  <span className="sr-only">Open</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {documents.map((item) => (
                <DocumentRow key={item.id} doc={item} />
              ))}
            </TBody>
          </Table>
          </div>
          </>
        )}
      </Card>
      {selected && selectedView ? <Detail doc={selected} view={selectedView} /> : null}
      {chat ? (
        <EmbeddingsCard
          enabled={chat.embeddings.enabled}
          model={chat.embeddings.model}
          dim={chat.embeddings.dim}
          defaultModel={env.OPENROUTER_EMBED_MODEL ?? null}
          hasKey={hasOpenRouter()}
          localDatabase={isPglite()}
        />
      ) : null}
    </div>
  );
}

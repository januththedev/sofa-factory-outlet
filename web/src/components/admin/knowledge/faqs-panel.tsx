import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/field';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { listFaqs, MAX_UPLOAD_BYTES, readLastEval, toEvalView } from '@/lib/admin/knowledge';
import { FaqDialog } from './faq-dialog';
import { FaqSwitch } from './faq-switch';
import { GoldenCard } from './golden-card';
import { UploadPanel } from './upload-panel';

const FAQ_SHAPE = '[{ "q": "...", "alt": ["..."], "a": "...", "tags": ["..."] }]';

const pageHref = (q: string, page: number) => {
  const params = new URLSearchParams({ tab: 'faqs', page: String(page) });
  if (q) params.set('q', q);
  return `/admin/knowledge/?${params.toString()}`;
};

/**
 * The FAQs tab. Each FAQ is an instant answer: a close match to the question or any of its alternatives is
 * answered from here with no model call.
 */
export async function FaqsPanel({ q, page }: { q: string; page: number }) {
  const [list, lastEval] = await Promise.all([listFaqs({ search: q, page }), readLastEval()]);
  const evalView = lastEval ? toEvalView(lastEval) : null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>FAQs</CardTitle>
            <p className="mt-1 text-sm text-mute">
              {list.total} {list.total === 1 ? 'question' : 'questions'}
              {q ? ` matching "${q}"` : ''}. Matches are answered instantly, without the model.
            </p>
          </div>
          <FaqDialog />
        </CardHeader>
        <CardBody className="border-b border-line">
          <form action="/admin/knowledge/" method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="faqs" />
            <div className="min-w-0 flex-1 basis-64">
              <Label htmlFor="faq-search">Search the FAQs</Label>
              <Input id="faq-search" name="q" defaultValue={q} placeholder="Question, alternative or answer" />
            </div>
            <Button type="submit" variant="ghost">
              Search
            </Button>
            {q ? (
              <Link
                href="/admin/knowledge/?tab=faqs"
                className="pb-3 text-sm text-maroon underline-offset-4 hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </CardBody>
        {list.rows.length === 0 ? (
          <CardBody>
            <p className="text-sm text-mute">{q ? 'No FAQ matches that search.' : 'No FAQs yet. Add one above.'}</p>
          </CardBody>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Question</TH>
                <TH className="hidden md:table-cell">Answer</TH>
                <TH className="hidden lg:table-cell">Tags</TH>
                <TH>Hits</TH>
                <TH>Use in chat</TH>
                <TH>
                  <span className="sr-only">Edit</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {list.rows.map((faq) => (
                <TR key={faq.id}>
                  <TD className="max-w-xs">
                    <p className="font-semibold">{faq.question}</p>
                    {faq.alternatives.length > 0 ? (
                      <p className="mt-1 text-xs text-mute">
                        Also: {faq.alternatives.slice(0, 3).join(' / ')}
                        {faq.alternatives.length > 3 ? ` and ${faq.alternatives.length - 3} more` : ''}
                      </p>
                    ) : null}
                    {faq.source === 'gap' ? (
                      <Badge tone="maroon" className="mt-1">
                        From a gap
                      </Badge>
                    ) : null}
                  </TD>
                  <TD className="hidden max-w-md md:table-cell">
                    <p className="line-clamp-3 text-ink-2">{faq.answer}</p>
                  </TD>
                  <TD className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {faq.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  </TD>
                  <TD>{faq.hitCount}</TD>
                  <TD>
                    <FaqSwitch key={faq.id} id={faq.id} question={faq.question} enabled={faq.enabled} />
                  </TD>
                  <TD>
                    <FaqDialog
                      faq={{
                        id: faq.id,
                        question: faq.question,
                        alternatives: faq.alternatives,
                        answer: faq.answer,
                        tags: faq.tags,
                        enabled: faq.enabled,
                      }}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {list.pages > 1 ? (
          <CardBody className="flex items-center justify-between gap-3 border-t border-line text-sm">
            {list.page > 1 ? (
              <Link href={pageHref(q, list.page - 1)} className="text-maroon underline-offset-4 hover:underline">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-mute">
              Page {list.page} of {list.pages}
            </span>
            {list.page < list.pages ? (
              <Link href={pageHref(q, list.page + 1)} className="text-maroon underline-offset-4 hover:underline">
                Next
              </Link>
            ) : (
              <span />
            )}
          </CardBody>
        ) : null}
      </Card>
      <UploadPanel
        only="json"
        maxBytes={MAX_UPLOAD_BYTES}
        lastEval={evalView}
        heading="Import FAQs from a JSON file"
        help={`A list like ${FAQ_SHAPE}. Questions that already exist are updated. Up to 1 MB.`}
      />
      <GoldenCard />
    </div>
  );
}

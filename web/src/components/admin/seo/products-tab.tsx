import Link from 'next/link';
import { EmptyNote } from '@/components/admin/seo/ui';
import { ScoreBadge } from '@/components/admin/seo/ui';
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
import { getProductSeoReport } from '@/lib/admin/seo';

const STATUS_TONE = { published: 'good', draft: 'neutral', hidden: 'warn' } as const;

export async function ProductsTab() {
  const { rows, checklistAvailable } = await getProductSeoReport();
  const counts = { green: 0, amber: 0, red: 0 };
  for (const row of rows) if (row.score) counts[row.score] += 1;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Product SEO checklist</CardTitle>
          <p className="mt-1 text-base sm:text-sm text-mute">
            Five checks per product: search title and description, photos with alt text, product copy, a price and a
            related guide. Green passes all five, amber three or four, red fewer.
          </p>
        </div>
      </CardHeader>
      {!checklistAvailable ? (
        <CardBody>
          <p role="status" className="rounded-xl bg-bone-2 px-4 py-3 text-base sm:text-sm text-ink-2">
            — The checklist could not be read, so scores are not shown. The products are listed below with their
            editor links.
          </p>
        </CardBody>
      ) : (
        <CardBody className="flex flex-wrap gap-3 pb-0 text-base sm:text-sm">
          <Badge tone="good">{counts.green} green</Badge>
          <Badge tone="warn">{counts.amber} amber</Badge>
          <Badge tone="bad">{counts.red} red</Badge>
        </CardBody>
      )}
      {rows.length === 0 ? (
        <EmptyNote>There are no products yet.</EmptyNote>
      ) : (
        <Table className="mt-4">
          <caption className="sr-only">SEO checklist score for every product, worst first</caption>
          <THead>
            <TR>
              <TH scope="col">Product</TH>
              <TH scope="col">Score</TH>
              <TH scope="col">Checks passed</TH>
              <TH scope="col">What needs work</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link href={`/admin/products/${row.id}/`} className="font-medium text-maroon hover:underline">
                    {row.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                    {row.noindex ? <Badge tone="warn">noindex</Badge> : null}
                  </div>
                </TD>
                <TD>
                  <ScoreBadge score={row.score} />
                </TD>
                <TD className="tabular-nums">{row.passed === null ? '—' : `${row.passed} of ${row.total}`}</TD>
                <TD>
                  {row.score === null ? (
                    <span className="text-mute">—</span>
                  ) : row.failing.length === 0 ? (
                    <span className="text-mute">Nothing</span>
                  ) : (
                    <ul className="space-y-1">
                      {row.failing.map((check) => (
                        <li key={check.id}>
                          <span className="font-medium">{check.label}</span>
                          <span className="text-mute">: {check.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

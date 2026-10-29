import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { getSeoProblems } from '@/lib/admin/seo';
import type { SeoProblems } from '@/lib/admin/seo';

/** What needs fixing on the site itself. (Google ranking numbers are not connected.) */
export async function OverviewTab() {
  const problems = await getSeoProblems();
  return (
    <div className="space-y-6">
      <Problems problems={problems} />
    </div>
  );
}

function Problems({ problems }: { problems: SeoProblems }) {
  const { weakProducts, noindexProducts, hiddenWithRedirects, checklistAvailable } = problems;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pages with problems</CardTitle>
      </CardHeader>
      <CardBody className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="problem-checklist">
          <h3 id="problem-checklist" className="font-semibold">
            Products failing the SEO checklist
          </h3>
          {!checklistAvailable ? (
            <p className="mt-2 text-base sm:text-sm text-mute">— The SEO checklist is not available yet.</p>
          ) : weakProducts.length === 0 ? (
            <p className="mt-2 text-base sm:text-sm text-mute">Every published product is green.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-base sm:text-sm">
              {weakProducts.map((product) => (
                <li key={product.id}>
                  <Link href={`/admin/products/${product.id}/`} className="font-medium text-maroon hover:underline">
                    {product.name}
                  </Link>{' '}
                  <Badge tone={product.score === 'red' ? 'bad' : 'warn'}>
                    {product.score === 'red' ? 'Red' : 'Amber'}
                  </Badge>
                  <p className="mt-0.5 text-mute">Needs: {product.failing.join(', ')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="problem-noindex">
          <h3 id="problem-noindex" className="font-semibold">
            Published but hidden from Google
          </h3>
          {noindexProducts.length === 0 ? (
            <p className="mt-2 text-base sm:text-sm text-mute">No published product is set to noindex.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-base sm:text-sm">
              {noindexProducts.map((product) => (
                <li key={product.id}>
                  <Link href={`/admin/products/${product.id}/`} className="font-medium text-maroon hover:underline">
                    {product.name}
                  </Link>
                  <span className="text-mute"> /product/{product.slug}/ is marked noindex</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="problem-hidden">
          <h3 id="problem-hidden" className="font-semibold">
            Hidden products still being visited
          </h3>
          {hiddenWithRedirects.length === 0 ? (
            <p
              className="mt-2 text-base sm:text-sm text-mute">
              No visitors are arriving on a hidden product&apos;s old address.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-base sm:text-sm">
              {hiddenWithRedirects.map((redirect) => (
                <li key={redirect.id}>
                  <span className="break-all font-medium">{redirect.from}</span>
                  <span className="text-mute">
                    {' '}
                    sent {redirect.hits} {redirect.hits === 1 ? 'visit' : 'visits'} to {redirect.to ?? 'a gone page'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardBody>
    </Card>
  );
}

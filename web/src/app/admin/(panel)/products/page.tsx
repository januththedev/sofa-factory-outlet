import { OpsFrame } from '@/components/admin/settings/ops-frame';
import { and } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { desc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { ilike } from 'drizzle-orm';
import { Picture } from '@/components/picture';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { ProductBulkActions } from '@/components/admin/products/product-bulk-actions';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import { Table } from '@/components/ui/table';
import { TBody } from '@/components/ui/table';
import { TD } from '@/components/ui/table';
import { TH } from '@/components/ui/table';
import { THead } from '@/components/ui/table';
import { TR } from '@/components/ui/table';
import { evaluateSeoChecklist } from '@/lib/admin/seo-checklist';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { pictureData } from '@/lib/images/urls';
import { formatLkr } from '@/lib/money';

export const dynamic = 'force-dynamic';

const noteHelp: Record<string, string> = {
  'borrowed-images': 'One or more images may belong to another catalogue.',
  'supplier-photos': 'Confirm that supplier photo use is licensed.',
  'photo-mismatch': 'The photos may show a different product or colour.',
  'no-description': 'Add useful product copy before publishing.',
  'derived-facets': 'Material or shape was inferred during import.',
  'size-options': 'Confirm the available size choices.',
  'price-on-request': 'Publishing a from price can improve search visibility.',
  'no-dimensions': 'Measure and add the product dimensions.',
};

type Props = {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const session = await requireRole('any');
  const filters = await searchParams;
  const db = await getDb();
  const conditions = [];
  if (filters.q) conditions.push(ilike(s.products.name, `%${filters.q}%`));
  if (filters.status === 'draft' || filters.status === 'published' || filters.status === 'hidden') {
    conditions.push(eq(s.products.status, filters.status));
  }
  const categoryId = Number(filters.category);
  if (Number.isInteger(categoryId) && categoryId > 0) conditions.push(eq(s.products.categoryId, categoryId));
  const products = await db.select({ product: s.products, category: s.categories })
    .from(s.products)
    .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(s.products.updatedAt));
  const categories = await db.select().from(s.categories)
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
  const variants = await db.select().from(s.productVariants).orderBy(asc(s.productVariants.sortOrder));

  return (
    <OpsFrame>
      <PageHeader
        title="Products"
        description="Keep the catalogue, search and product pages current from one place."
        actions={(
          <>
            <Link className="btn btn-ghost" href="/admin/products/import/">Import CSV</Link>
            <Link className="btn btn-primary min-h-11 min-w-11" href="/admin/products/new/">New product</Link>
          </>
        )}
      />
      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2">
          <span className="block">Search products</span>
          <Input name="q" type="search" defaultValue={filters.q} placeholder="Search products" />
        </label>
        <label className="space-y-2"><span className="block">Status</span>
        <Select name="status" defaultValue={filters.status ?? ''} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
        </Select>
        </label>
        <label className="space-y-2"><span className="block">Category</span>
        <Select name="category" defaultValue={filters.category ?? ''} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
        </label>
        <button className="btn btn-ghost min-h-11 self-end" type="submit">Apply filters</button>
      </form>
      <ProductBulkActions ids={products.map(({ product }) => product.id)} owner={session.role === 'owner'} />
      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5">
          No products match. Clear the filters or choose New product to add one.
        </p>
      ) : null}
      <ul className="mb-6 grid gap-3 lg:hidden">
        {products.map(({ product, category }) => {
          const photos = variants.filter((variant) => variant.productId === product.id)
            .flatMap((variant) => variant.images);
          const checklist = evaluateSeoChecklist({
            name: product.name,
            seoTitle: product.seoTitle,
            seoDescription: product.seoDescription,
            photoCount: photos.length,
            photosWithAlt: photos.filter((photo) => photo.alt.trim()).length,
            descriptionMd: product.descriptionMd,
            priceMinor: product.priceMinor,
            tags: product.tags,
          });
          return (
            <li key={product.id} className="min-w-0 rounded-xl border border-line bg-paper p-4">
              <div className="flex items-start gap-3">
                {photos[0] ? (
                  <Picture
                    data={pictureData(photos[0], 480)}
                    sizes="72px"
                    className="block size-18 shrink-0"
                    imgClassName={`size-full rounded-lg ${photos[0].cutout
                      ? 'object-contain mix-blend-multiply' : 'object-cover'}`}
                  />
                ) : <span className="grid size-18 shrink-0 place-items-center bg-bone text-xs">No photo</span>}
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${product.id}/`}
                    className="flex min-h-11 items-center break-words font-semibold text-maroon">
                    {product.name}
                  </Link>
                  <p className="text-base sm:text-sm text-mute">{category.name}</p>
                  <Badge>{product.status}</Badge>
                </div>
              </div>
              <p className="mt-3 font-semibold">
                {product.priceMinor === null
                  ? 'On request'
                  : `${product.priceFrom ? 'From ' : ''}${formatLkr(product.priceMinor)}`}
              </p>
              <p
                className="mt-2 text-base sm:text-sm">
                SEO checklist: {checklist.passed}/{checklist.total} ({checklist.score})
              </p>
            </li>
          );
        })}
      </ul>
      <div className="hidden min-w-0 lg:block">
      <Table>
        <THead>
          <TR>
            <TH>Product</TH><TH>Category</TH><TH>Status</TH><TH>Price</TH><TH>SEO</TH><TH>Updated</TH>
          </TR>
        </THead>
        <TBody>
          {products.map(({ product, category }) => {
            const productVariants = variants.filter((variant) => variant.productId === product.id);
            const images = productVariants.flatMap((variant) => variant.images);
            const seo = evaluateSeoChecklist({
              name: product.name,
              seoTitle: product.seoTitle,
              seoDescription: product.seoDescription,
              photoCount: images.length,
              photosWithAlt: images.filter((image) => image.alt.trim()).length,
              descriptionMd: product.descriptionMd,
              priceMinor: product.priceMinor,
              tags: product.tags,
            });
            const scoreClass = seo.score === 'green'
              ? 'bg-good'
              : seo.score === 'amber' ? 'bg-warn' : 'bg-bad';
            return (
              <TR key={product.id}>
                <TD>
                  <div className="flex min-w-52 items-start gap-3">
                    {images[0] ? (
                      <Picture
                        data={pictureData(images[0], 480)}
                        sizes="48px"
                        className="block size-12 shrink-0"
                        imgClassName={`size-full rounded-lg ${images[0].cutout
                          ? 'object-contain mix-blend-multiply' : 'object-cover'}`}
                      />
                    ) : (
                      <span className="grid size-12 place-items-center rounded-lg bg-bone text-xs text-mute">
                        No photo
                      </span>
                    )}
                    <div>
                      <Link className="font-semibold text-maroon" href={`/admin/products/${product.id}/`}>
                        {product.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {product.reviewNotes.map((note) => (
                          <span
                            key={note}
                            title={noteHelp[note] ?? note}
                            className="rounded bg-warn/15 px-2 py-0.5 text-xs"
                          >
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD>{category.name}</TD>
                <TD><Badge>{product.status}</Badge></TD>
                <TD>
                  {product.priceMinor === null
                    ? 'On request'
                    : `${product.priceFrom ? 'From ' : ''}${formatLkr(product.priceMinor)}`}
                </TD>
                <TD>
                  <span
                    title={`${seo.passed}/${seo.total} checks`}
                    className={`inline-block size-3 rounded-full ${scoreClass}`}
                  />
                </TD>
                <TD>{product.updatedAt.toLocaleDateString('en-LK')}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      </div>
    </OpsFrame>
  );
}

import { OpsFrame } from '@/components/admin/settings/ops-frame';
import { asc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { ProductEditor } from '@/components/admin/products/product-editor';
import { mediaBase } from '@/lib/storage';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  await requireRole('any');
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();
  const db = await getDb();
  const [product] = await db.select().from(s.products)
    .where(eq(s.products.id, productId))
    .limit(1);
  if (!product) notFound();
  const variants = await db.select().from(s.productVariants)
    .where(eq(s.productVariants.productId, productId))
    .orderBy(asc(s.productVariants.sortOrder));
  const categories = await db.select({ id: s.categories.id, name: s.categories.name })
    .from(s.categories)
    .orderBy(asc(s.categories.name));
  return (
    <OpsFrame>
      <PageHeader
        title={product.name}
        description="Edit product details, photos, colours and search presentation."
      />
      <ProductEditor
        categories={categories}
        mediaBaseUrl={mediaBase()}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          categoryId: product.categoryId,
          shortDescription: product.shortDescription,
          descriptionMd: product.descriptionMd,
          sellingPoints: product.sellingPoints,
          material: product.material,
          shape: product.shape,
          seats: product.seats,
          tags: product.tags,
          dimensions: product.dimensions,
          priceMinor: product.priceMinor,
          compareAtMinor: product.compareAtMinor,
          priceFrom: product.priceFrom,
          status: product.status,
          featured: product.featured,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          noindex: product.noindex,
          variants,
        }}
      />
    </OpsFrame>
  );
}

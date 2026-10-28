import { OpsFrame } from '@/components/admin/settings/ops-frame';
import { asc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { ProductEditor } from '@/components/admin/products/product-editor';
import { mediaBase } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireRole('any');
  const db = await getDb();
  const categories = await db.select({ id: s.categories.id, name: s.categories.name })
    .from(s.categories)
    .orderBy(asc(s.categories.name));
  return (
    <OpsFrame>
      <PageHeader title="New product" description="Saving updates every catalogue surface automatically." />
      <ProductEditor
        categories={categories}
        mediaBaseUrl={mediaBase()}
        initial={{
          name: '',
          slug: '',
          categoryId: categories[0]?.id ?? 0,
          descriptionMd: '',
          priceMinor: null,
          priceFrom: false,
          status: 'draft',
          featured: false,
          noindex: false,
          tags: [],
          variants: [],
        }}
      />
    </OpsFrame>
  );
}

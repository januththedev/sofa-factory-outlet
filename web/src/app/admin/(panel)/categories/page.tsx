import type { Metadata } from 'next';
import { CatalogueForm } from '@/components/admin/products/catalogue-form';
import { OpsFrame } from '@/components/admin/settings/ops-frame';
import { asc } from 'drizzle-orm';
import { ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { CategoryImageUpload } from '@/components/admin/products/category-image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { deleteComplementAction } from './actions';
import { deletePairingAction } from './actions';
import { saveComplementAction } from './actions';
import { savePairingAction } from './actions';
import { updateCategoryAction } from './actions';

export const metadata: Metadata = { title: 'Categories' };

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const session = await requireRole('any');
  const db = await getDb();
  const categories = await db.select().from(s.categories)
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.path));
  const pairings = await db.select().from(s.colourPairings).orderBy(asc(s.colourPairings.family));
  const complements = await db.select().from(s.categoryComplements);
  const disabled = session.role !== 'owner';
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <OpsFrame>
      <PageHeader
        title="Categories and colour rules"
        description={disabled
          ? 'Staff can view these catalogue rules. An owner can edit them.'
          : 'Edit category hubs and the rules behind complementary suggestions.'}
      />
      <div className="space-y-8">
        <section>
          <h2 className="mb-1 font-display text-2xl">Category tree</h2>
          <p className="mb-4 text-sm text-mute">
            Open a category to {disabled ? 'see' : 'edit'} its introduction, tips and search text.
          </p>
          <div className="space-y-4">
            {categories.map((category) => (
              <details
                key={category.id}
                className="group rounded-[var(--radius-card)] border border-line bg-paper"
              >
                <summary
                  className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3
                    [&::-webkit-details-marker]:hidden"
                >
                  <span className="min-w-0">
                    <span className="font-display text-xl">{category.name}</span>
                    <span className="ml-3 text-xs uppercase text-mute">{category.kind} · /{category.path}/</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-mute">
                    <span className="group-open:hidden">{disabled ? 'View' : 'Edit'}</span>
                    <span className="hidden group-open:inline">Close</span>
                    <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
              <CatalogueForm
                action={updateCategoryAction}
                className="grid gap-3 border-t border-line p-5 md:grid-cols-2"
              >
                <input type="hidden" name="id" value={category.id} />
                <label>
                  <span className="mb-2 block font-medium">Name</span>
                  <Input name="name" defaultValue={category.name} disabled={disabled} />
                </label>
                <label>
                  <span className="mb-2 block font-medium">Sort order</span>
                  <Input name="sortOrder" type="number" defaultValue={category.sortOrder} disabled={disabled} />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-2 block font-medium">Introduction</span>
                  <Textarea name="intro" defaultValue={category.intro ?? ''} disabled={disabled} />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-2 block font-medium">Buying tips</span>
                  <Textarea name="tips" defaultValue={category.tips ?? ''} disabled={disabled} />
                </label>
                <label>
                  <span className="mb-2 block font-medium">SEO title</span>
                  <Input name="seoTitle" defaultValue={category.seoTitle ?? ''} disabled={disabled} />
                </label>
                <label>
                  <span className="mb-2 block font-medium">SEO description</span>
                  <Input name="seoDescription" defaultValue={category.seoDescription ?? ''} disabled={disabled} />
                </label>
                <label>
                  <span className="mb-2 block font-medium">Hub shape filter</span>
                  <Input name="hubFilterShape" defaultValue={category.hubFilter?.shape ?? ''} disabled={disabled} />
                </label>
                <label>
                  <span className="mb-2 block font-medium">Hub material filter</span>
                  <Input
                    name="hubFilterMaterial"
                    defaultValue={category.hubFilter?.material ?? ''}
                    disabled={disabled}
                  />
                </label>
                <CategoryImageUpload categoryId={category.id} slug={category.slug} disabled={disabled} />
                {!disabled ? <Button type="submit" className="md:col-span-2">Save category</Button> : null}
              </CatalogueForm>
              </details>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-4 font-display text-2xl">Colour rules</h2>
          <div className="space-y-3">
            {pairings.map((pairing) => (
              <CatalogueForm
                key={pairing.id}
                action={savePairingAction} deleteAction={deletePairingAction}
                className="grid gap-3 rounded-xl border border-line bg-paper p-4 xl:grid-cols-5"
              >
                <input type="hidden" name="id" value={pairing.id} />
                <Input name="family" aria-label="Colour family" defaultValue={pairing.family} disabled={disabled} />
                <Input name="pairsWith" aria-label="Pairs with" defaultValue={pairing.pairsWith} disabled={disabled} />
                <Input
                  name="weight"
                  aria-label="Weight"
                  type="number"
                  step="0.1"
                  defaultValue={pairing.weight}
                  disabled={disabled}
                />
                <Input name="reason" aria-label="Reason" defaultValue={pairing.reason ?? ''} disabled={disabled} />
                {!disabled ? (
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Save</Button>
                    <Button
                      data-delete="true"
                      name="id"
                      value={pairing.id}
                      type="submit"
                      size="sm"
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </CatalogueForm>
            ))}
          </div>
          {!disabled ? (
            <CatalogueForm
              action={savePairingAction} deleteAction={deletePairingAction}
              className="mt-4 grid gap-3 rounded-xl border border-dashed border-line p-4 xl:grid-cols-5"
            >
              <label><span className="block">Family</span><Input name="family" placeholder="Family" /></label>
              <label>
              <span className="block">Pairs with</span>
              <Input name="pairsWith" placeholder="Pairs with" />
              </label>
              <label>
              <span className="block">Weight</span>
              <Input name="weight" type="number" step="0.1" defaultValue="1" />
              </label>
              <label><span className="block">Reason</span><Input name="reason" placeholder="Reason verb" /></label>
              <Button type="submit">Add rule</Button>
            </CatalogueForm>
          ) : null}
        </section>
        <section>
          <h2 className="mb-4 font-display text-2xl">Category complements</h2>
          <div className="mb-4 space-y-2">
            {complements.map((complement) => (
              <CatalogueForm
                key={complement.id}
                action={deleteComplementAction} confirm="Remove this category complement? This cannot be undone."
                className="flex flex-wrap items-center gap-3 text-base"
              >
                <input type="hidden" name="id" value={complement.id} />
                <span>
                  {categoryNames.get(complement.categoryId)} → {categoryNames.get(complement.complementId)}
                  {' '}({complement.weight})
                </span>
                {!disabled ? <Button size="sm" variant="danger" type="submit">Remove</Button> : null}
              </CatalogueForm>
            ))}
          </div>
          {!disabled ? (
            <CatalogueForm
              action={saveComplementAction}
              className="grid gap-3 rounded-xl border border-line bg-paper p-4 xl:grid-cols-4"
            >
              <label>
              <span className="block">Category</span>
              <select className="min-h-11 w-full rounded-xl border border-line p-3 text-base" name="categoryId">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select></label>
              <label>
              <span className="block">Complement</span>
              <select className="min-h-11 w-full rounded-xl border border-line p-3 text-base" name="complementId">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select></label>
              <label>
              <span className="block">Weight</span>
              <Input name="weight" type="number" step="0.1" defaultValue="1" />
              </label>
              <Button type="submit">Save complement</Button>
            </CatalogueForm>
          ) : null}
        </section>
      </div>
    </OpsFrame>
  );
}

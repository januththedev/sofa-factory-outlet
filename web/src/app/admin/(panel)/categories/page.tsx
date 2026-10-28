import { asc } from 'drizzle-orm';
import { PageHeader } from '@/components/admin/page-header';
import { CategoryImageUpload } from '@/components/admin/products/category-image-upload';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import {
  deleteComplementFormAction,
  deletePairingFormAction,
  saveComplementFormAction,
  savePairingFormAction,
  updateCategoryFormAction,
} from './actions';

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
    <>
      <PageHeader
        title="Categories and colour rules"
        description={disabled
          ? 'Staff can view these catalogue rules. An owner can edit them.'
          : 'Edit category hubs and the rules behind complementary suggestions.'}
      />
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 font-display text-2xl">Category tree</h2>
          <div className="space-y-4">
            {categories.map((category) => (
              <form
                key={category.id}
                action={updateCategoryFormAction}
                className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-5 md:grid-cols-2"
              >
                <input type="hidden" name="id" value={category.id} />
                <p className="text-xs uppercase text-mute md:col-span-2">
                  {category.kind} · /{category.path}/
                </p>
                <label>
                  <Label>Name</Label>
                  <Input name="name" defaultValue={category.name} disabled={disabled} />
                </label>
                <label>
                  <Label>Sort order</Label>
                  <Input name="sortOrder" type="number" defaultValue={category.sortOrder} disabled={disabled} />
                </label>
                <label className="md:col-span-2">
                  <Label>Introduction</Label>
                  <Textarea name="intro" defaultValue={category.intro ?? ''} disabled={disabled} />
                </label>
                <label className="md:col-span-2">
                  <Label>Buying tips</Label>
                  <Textarea name="tips" defaultValue={category.tips ?? ''} disabled={disabled} />
                </label>
                <label>
                  <Label>SEO title</Label>
                  <Input name="seoTitle" defaultValue={category.seoTitle ?? ''} disabled={disabled} />
                </label>
                <label>
                  <Label>SEO description</Label>
                  <Input name="seoDescription" defaultValue={category.seoDescription ?? ''} disabled={disabled} />
                </label>
                <label>
                  <Label>Hub shape filter</Label>
                  <Input name="hubFilterShape" defaultValue={category.hubFilter?.shape ?? ''} disabled={disabled} />
                </label>
                <label>
                  <Label>Hub material filter</Label>
                  <Input
                    name="hubFilterMaterial"
                    defaultValue={category.hubFilter?.material ?? ''}
                    disabled={disabled}
                  />
                </label>
                <CategoryImageUpload categoryId={category.id} slug={category.slug} disabled={disabled} />
                {!disabled ? <Button type="submit" className="md:col-span-2">Save category</Button> : null}
              </form>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-4 font-display text-2xl">Colour rules</h2>
          <div className="space-y-3">
            {pairings.map((pairing) => (
              <form
                key={pairing.id}
                action={savePairingFormAction}
                className="grid gap-3 rounded-xl border border-line bg-paper p-4 sm:grid-cols-5"
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
                      formAction={deletePairingFormAction}
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
              </form>
            ))}
          </div>
          {!disabled ? (
            <form
              action={savePairingFormAction}
              className="mt-4 grid gap-3 rounded-xl border border-dashed border-line p-4 sm:grid-cols-5"
            >
              <Input name="family" placeholder="Family" />
              <Input name="pairsWith" placeholder="Pairs with" />
              <Input name="weight" type="number" step="0.1" defaultValue="1" />
              <Input name="reason" placeholder="Reason verb" />
              <Button type="submit">Add rule</Button>
            </form>
          ) : null}
        </section>
        <section>
          <h2 className="mb-4 font-display text-2xl">Category complements</h2>
          <div className="mb-4 space-y-2">
            {complements.map((complement) => (
              <form
                key={complement.id}
                action={deleteComplementFormAction}
                className="flex items-center gap-3 text-sm"
              >
                <input type="hidden" name="id" value={complement.id} />
                <span>
                  {categoryNames.get(complement.categoryId)} → {categoryNames.get(complement.complementId)}
                  {' '}({complement.weight})
                </span>
                {!disabled ? <Button size="sm" variant="danger" type="submit">Remove</Button> : null}
              </form>
            ))}
          </div>
          {!disabled ? (
            <form
              action={saveComplementFormAction}
              className="grid gap-3 rounded-xl border border-line bg-paper p-4 sm:grid-cols-4"
            >
              <select className="rounded-xl border border-line p-3" name="categoryId">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select className="rounded-xl border border-line p-3" name="complementId">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <Input name="weight" type="number" step="0.1" defaultValue="1" />
              <Button type="submit">Save complement</Button>
            </form>
          ) : null}
        </section>
      </div>
    </>
  );
}

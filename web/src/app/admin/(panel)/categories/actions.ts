'use server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { ImageRef } from '@/lib/db/schema/types';
import { revalidateCatalogue } from '@/lib/revalidate';

const categorySchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1),
  intro: z.string().max(20_000),
  tips: z.string().max(20_000),
  seoTitle: z.string().max(80),
  seoDescription: z.string().max(200),
  sortOrder: z.coerce.number().int(),
  hubFilterShape: z.string(),
  hubFilterMaterial: z.string(),
});

export async function updateCategoryAction(formData: FormData) {
  await requireRole('owner');
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Check the category fields.' };
  const value = parsed.data;
  const db = await getDb();
  await db.update(s.categories).set({
    name: value.name,
    intro: value.intro || null,
    tips: value.tips || null,
    seoTitle: value.seoTitle || null,
    seoDescription: value.seoDescription || null,
    sortOrder: value.sortOrder,
    hubFilter: value.hubFilterShape || value.hubFilterMaterial
      ? { shape: value.hubFilterShape || undefined, material: value.hubFilterMaterial || undefined }
      : null,
    updatedAt: new Date(),
  }).where(eq(s.categories.id, value.id));
  revalidateCatalogue();
  return { ok: true };
}

export async function updateCategoryImageAction(categoryId: number, image: ImageRef) {
  await requireRole('owner');
  const parsed = z.object({
    categoryId: z.number().int().positive(),
    image: z.object({
      key: z.string().min(1),
      w: z.number().int().positive(),
      h: z.number().int().positive(),
      widths: z.array(z.number().int().positive()).min(1),
      alt: z.string(),
      blur: z.string().optional(),
      dominant: z.string().optional(),
      flag: z.enum(['borrowed', 'licence']).nullable().optional(),
      cutout: z.boolean().optional(),
      source: z.string().optional(),
    }),
  }).safeParse({ categoryId, image });
  if (!parsed.success) return { ok: false, error: 'The category image is invalid.' };
  const db = await getDb();
  await db.update(s.categories).set({
    image: parsed.data.image,
    updatedAt: new Date(),
  }).where(eq(s.categories.id, parsed.data.categoryId));
  revalidateCatalogue();
  return { ok: true };
}

export async function deleteComplementAction(formData: FormData) {
  await requireRole('owner');
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'Choose a valid category complement.' };
  const db = await getDb();
  await db.delete(s.categoryComplements).where(eq(s.categoryComplements.id, id.data));
  revalidateCatalogue();
  return { ok: true };
}

const pairingSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  family: z.string().trim().min(1),
  pairsWith: z.string().trim().min(1),
  weight: z.coerce.number().positive(),
  reason: z.string().trim().max(300),
});

export async function savePairingAction(formData: FormData) {
  await requireRole('owner');
  const parsed = pairingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Check the colour rule.' };
  const db = await getDb();
  const value = parsed.data;
  const values = {
    family: value.family,
    pairsWith: value.pairsWith,
    weight: value.weight,
    reason: value.reason || null,
  };
  if (value.id) await db.update(s.colourPairings).set(values).where(eq(s.colourPairings.id, value.id));
  else await db.insert(s.colourPairings).values(values);
  revalidateCatalogue();
  return { ok: true };
}

export async function deletePairingAction(formData: FormData) {
  await requireRole('owner');
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'Choose a valid colour rule.' };
  const db = await getDb();
  await db.delete(s.colourPairings).where(eq(s.colourPairings.id, id.data));
  revalidateCatalogue();
  return { ok: true };
}

export async function saveComplementAction(formData: FormData) {
  await requireRole('owner');
  const parsed = z.object({
    categoryId: z.coerce.number().int().positive(),
    complementId: z.coerce.number().int().positive(),
    weight: z.coerce.number().positive(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'Check the category complement.' };
  const db = await getDb();
  await db.insert(s.categoryComplements).values(parsed.data).onConflictDoUpdate({
    target: [s.categoryComplements.categoryId, s.categoryComplements.complementId],
    set: { weight: parsed.data.weight },
  });
  revalidateCatalogue();
  return { ok: true };
}

export async function updateCategoryFormAction(formData: FormData): Promise<void> {
  await requireRole('owner');
  await updateCategoryAction(formData);
}

export async function savePairingFormAction(formData: FormData): Promise<void> {
  await requireRole('owner');
  await savePairingAction(formData);
}

export async function deletePairingFormAction(formData: FormData): Promise<void> {
  await requireRole('owner');
  await deletePairingAction(formData);
}

export async function saveComplementFormAction(formData: FormData): Promise<void> {
  await requireRole('owner');
  await saveComplementAction(formData);
}

export async function deleteComplementFormAction(formData: FormData): Promise<void> {
  await requireRole('owner');
  await deleteComplementAction(formData);
}

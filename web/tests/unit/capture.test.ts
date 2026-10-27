import { describe, expect, it } from 'vitest';
import { loadCapture, transformProduct } from '@/lib/seed/capture';

const { products } = loadCapture();
const seeds = products.map((p) => transformProduct(p));
const byId = (id: number) => seeds.find((s) => s.legacyId === id)!;

describe('capture → product seeds', () => {
  it('hides exactly the 20 products with borrowed catalogue photos', () => {
    expect(seeds).toHaveLength(35);
    expect(seeds.filter((s) => s.status === 'hidden')).toHaveLength(20);
    expect(seeds.filter((s) => s.status === 'published')).toHaveLength(15);
    for (const s of seeds.filter((x) => x.status === 'hidden')) {
      expect(s.legacyId).toBeGreaterThanOrEqual(303);
      expect(s.legacyId).toBeLessThanOrEqual(360);
    }
  });

  it('maps categories, sending the 22 uncategorised products to sofas', () => {
    const counts = seeds.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.categorySlug]: (acc[s.categorySlug] ?? 0) + 1 }), {});
    expect(counts).toEqual({ sofas: 22, beds: 1, ottomans: 1, tables: 4, chairs: 7 });
  });

  it('keeps prices in minor units with 0 meaning "price on request"', () => {
    const cover = byId(410);
    expect(cover.priceMinor).toBe(1_249_000);
    expect(cover.compareAtMinor).toBe(1_500_000);
    expect(cover.priceFrom).toBe(true);
    expect(cover.attributes.Size).toEqual(['King', 'Queen', 'Single', 'Super King']);
    expect(seeds.filter((s) => s.priceMinor === null)).toHaveLength(34);
  });

  it('splits display names from SEO titles and decodes entities', () => {
    const emerald = byId(688);
    expect(emerald.name).toBe('Luxury Emerald Green L-Shape Sofa');
    expect(emerald.seoTitle).toBe('Luxury Emerald Green L-Shape Sofa | Modern Furniture Colombo');
    expect(byId(330).name).toBe('Flair O’ Couture');
    expect(byId(360).seoTitle).toBeNull();
  });

  it('derives facets and colours for the client’s own sofas', () => {
    expect(byId(688)).toMatchObject({ shape: 'l-shape', material: 'velvet' });
    expect(byId(688).colour?.family).toBe('green');
    expect(byId(663)).toMatchObject({ material: 'leather', shape: 'set', seats: 6 });
    expect(byId(646).colour?.family).toBe('multi');
  });

  it('records review notes, including the 685 photo mismatch', () => {
    expect(byId(685).reviewNotes.some((n) => n.startsWith('photo-mismatch'))).toBe(true);
    expect(byId(345).reviewNotes).toContain('no-description');
    expect(byId(303).reviewNotes.some((n) => n.startsWith('borrowed-images'))).toBe(true);
    expect(byId(410).reviewNotes.some((n) => n.startsWith('supplier-photos'))).toBe(true);
  });

  it('cleans every description and drops the WhatsApp anchor', () => {
    for (const s of seeds) {
      expect(s.descriptionMd).not.toMatch(/<|data-| /);
    }
    expect(byId(410).descriptionMd).not.toMatch(/whatsapp/i);
  });

  it('gives every image real alt text', () => {
    for (const s of seeds) {
      for (const im of s.images) {
        expect(im.alt.length, `${s.legacyId}`).toBeGreaterThan(5);
        expect(im.alt).not.toMatch(/^bed sheet$|_/i);
      }
    }
  });
});

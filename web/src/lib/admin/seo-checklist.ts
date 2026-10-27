import { notImplemented } from '../not-implemented';

// CONTRACT STUB. Owner: "admin-products" agent. Keep these exports and signatures.
// Plan.md §10: five checks per product; the product list, editor and the SEO admin page all show the same result.

export type SeoCheckId = 'meta' | 'photos' | 'copy' | 'price' | 'guide';

export type SeoCheck = { id: SeoCheckId; label: string; pass: boolean; detail: string };

export type SeoChecklistInput = {
  name: string;
  seoTitle: string | null;
  seoDescription: string | null;
  photoCount: number;
  photosWithAlt: number;
  descriptionMd: string;
  priceMinor: number | null;
  /** a tag like `guide:sofa-fabrics-for-sri-lankas-humid-climate` links the product to a guide */
  tags: string[];
};

export type SeoScore = 'green' | 'amber' | 'red';

export type SeoChecklist = { checks: SeoCheck[]; passed: number; total: number; score: SeoScore };

/**
 * meta: title 30–60 characters (the SEO title, or the name when unset) and description 70–160;
 * photos: at least 4, all with alt text; copy: description of 150+ words; price: a price is set;
 * guide: a `guide:<slug>` tag. green = all 5, amber = 3 or 4, red = fewer than 3.
 */
export const evaluateSeoChecklist: (input: SeoChecklistInput) => SeoChecklist = () => notImplemented('evaluateSeoChecklist');

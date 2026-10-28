// Plan.md §10: the product list, editor and SEO admin page share these five checks.

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
export const evaluateSeoChecklist: (input: SeoChecklistInput) => SeoChecklist = (input) => {
  const title = input.seoTitle?.trim() || input.name.trim();
  const descriptionLength = input.seoDescription?.trim().length ?? 0;
  const words = input.descriptionMd.trim().split(/\s+/u).filter(Boolean).length;
  const checks: SeoCheck[] = [
    {
      id: 'meta',
      label: 'Search metadata',
      pass: title.length >= 30 && title.length <= 60 && descriptionLength >= 70 && descriptionLength <= 160,
      detail: `${title.length}/30–60 title characters; ${descriptionLength}/70–160 description characters`,
    },
    {
      id: 'photos',
      label: 'Product photos',
      pass: input.photoCount >= 4 && input.photosWithAlt === input.photoCount,
      detail: `${input.photoCount}/4 photos; ${input.photosWithAlt}/${input.photoCount} have alt text`,
    },
    {
      id: 'copy',
      label: 'Product copy',
      pass: words >= 150,
      detail: `${words}/150 words`,
    },
    {
      id: 'price',
      label: 'Price',
      pass: input.priceMinor !== null,
      detail: input.priceMinor === null ? 'No price is set' : 'Price is set',
    },
    {
      id: 'guide',
      label: 'Related guide',
      pass: input.tags.some((tag) => /^guide:[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tag)),
      detail: 'Add a guide:<slug> tag to link useful advice',
    },
  ];
  const passed = checks.filter((check) => check.pass).length;
  const score: SeoScore = passed === checks.length ? 'green' : passed >= 3 ? 'amber' : 'red';
  return { checks, passed, total: checks.length, score };
};

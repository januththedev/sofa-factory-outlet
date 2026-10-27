// Builds the text behind each product's full-text index. Built-in synonyms
// cover the words shoppers use for shapes and materials; admin-editable
// synonyms from the database are applied to the query at search time.

const SHAPE_WORDS: Record<string, string> = {
  'l-shape': 'l-shape l shape corner sofa sectional chaise',
  'u-shape': 'u-shape u shape sectional large family sofa modular',
  set: 'sofa set 3+2+1 three seater two seater single living room set',
  recliner: 'recliner reclining sofa tv room',
  single: 'single seater armchair',
};

const MATERIAL_WORDS: Record<string, string> = {
  velvet: 'velvet plush soft',
  leather: 'leather genuine leather wipe clean',
  corduroy: 'corduroy cord ribbed fabric',
  fabric: 'fabric upholstery cloth',
};

export type SearchTextInput = {
  name: string;
  categoryName?: string | null;
  material?: string | null;
  shape?: string | null;
  seats?: number | null;
  colours?: Array<{ name: string; family: string }>;
  tags?: string[];
  description?: string | null;
};

export function buildSearchText(input: SearchTextInput): string {
  const parts = [
    input.categoryName,
    input.material ? MATERIAL_WORDS[input.material] ?? input.material : null,
    input.shape ? SHAPE_WORDS[input.shape] ?? input.shape : null,
    input.seats ? `${input.seats} seater ${input.seats} seats` : null,
    ...(input.colours ?? []).map((c) => `${c.name} ${c.family}`),
    ...(input.tags ?? []).map((t) => t.replace(/-/g, ' ')),
    input.description,
  ];
  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

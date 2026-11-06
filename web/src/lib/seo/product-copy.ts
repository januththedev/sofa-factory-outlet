import type { ProductDetail } from '@/lib/catalogue/types';

// Search titles and descriptions for product pages when the admin has not written their own. Each one names
// the piece, its shape and colours and where it is made, so no two product pages share the same snippet.

const SHAPES: Record<string, string> = {
  'l-shape': 'L-shape corner sofa',
  'u-shape': 'U-shape sectional sofa',
  set: 'sofa set',
  single: 'sofa',
  recliner: 'recliner sofa',
};

const clip = (text: string, max: number) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};

export function productSearchTitle(product: Pick<ProductDetail, 'name' | 'seoTitle'>): string {
  return product.seoTitle ?? `${product.name} | Made in Sri Lanka | Sofa Factory Outlet`;
}

export function productSearchDescription(
  product: Pick<ProductDetail, 'name' | 'seoDescription' | 'shape' | 'seats' | 'category' | 'variants'>,
): string {
  if (product.seoDescription) return product.seoDescription;
  const kind = (product.shape && SHAPES[product.shape]) || product.category.name.toLowerCase().replace(/s$/, '');
  const colours = product.variants.map((v) => v.colourName.toLowerCase());
  const colourText = colours.length > 1 ? `, in ${colours.slice(0, -1).join(', ')} or ${colours.at(-1)}` : '';
  const seats = product.seats ? ` for ${product.seats}` : '';
  return clip(
    `${product.name}: a ${kind}${seats}${colourText}, made to order in our Colombo workshop and sold factory-direct in Sri Lanka. Choose the fabric and size, then see it at the showroom.`,
    160,
  );
}

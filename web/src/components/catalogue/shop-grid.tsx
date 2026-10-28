import { ProductTile } from './product-tile';
import type { ProductCard } from '@/lib/catalogue/queries';

export function ShopGrid({ products }: { products: ProductCard[] }) {
  return <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{products.map((product, index) =>
    <ProductTile key={product.id} product={product} priority={index < 3} sizes="(min-width: 1280px) 28vw, (min-width: 640px) 45vw, 92vw" />)}</div>;
}

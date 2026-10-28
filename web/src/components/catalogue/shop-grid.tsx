import { ProductTile } from './product-tile';
import type { ProductCard } from '@/lib/catalogue/queries';

export function ShopGrid({ products }: { products: ProductCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-7 min-[340px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductTile
          key={product.id}
          product={product}
          priority={index < 2}
          sizes="(min-width: 1024px) 20vw, (min-width: 768px) 30vw, (min-width: 340px) 46vw, 92vw"
        />
      ))}
    </div>
  );
}

import { ProductTile } from '@/components/catalogue/product-tile';
import { TLink } from '@/components/site/transition';
import type { ProductCard } from '@/lib/catalogue/queries';

export function Featured({ products }: { products: ProductCard[] }) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="featured-heading" className="bg-bone py-24 lg:py-36">
      <div className="site-container">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Featured pieces</p>
            <h2 id="featured-heading" className="mt-4 max-w-[16ch] text-[clamp(2.4rem,5.2vw,5rem)] font-light leading-[1]">
              Made recently, ready to see.
            </h2>
          </div>
          <TLink href="/shop/" className="btn-ghost">
            Browse the whole collection
          </TLink>
        </div>
        <ul className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <li key={product.id}>
              <ProductTile product={product} priority={index < 2} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { ProductTile } from '@/components/catalogue/product-tile';
import { TLink } from '@/components/site/transition';
import type { ProductCard } from '@/lib/catalogue/queries';
import { SwipeRail } from './swipe-rail';

export function Featured({ products }: { products: ProductCard[] }) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="featured-heading" className="bg-bone py-10 lg:py-36">
      <div className="site-container">
        <div className="flex flex-wrap items-end justify-between gap-3 lg:gap-6">
          <div>
            <p className="eyebrow text-xs">Featured pieces</p>
            <h2
              id="featured-heading"
              className="mt-3 max-w-[16ch] text-[clamp(2rem,5.2vw,5rem)] font-light leading-[1]"
            >
              Made recently, ready to see.
            </h2>
          </div>
          <TLink href="/shop/" className="btn-ghost min-h-11 min-w-11">
            Browse the whole collection
          </TLink>
        </div>
        <SwipeRail
          label="Featured pieces"
          className="mt-5 lg:mt-14"
          gridOnDesktop
          trackClassName="[&_article_span.rounded-full]:text-xs [&_article_p]:text-base"
        >
          {products.map((product) => (
            <li key={product.id} className="w-[86%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
              <ProductTile product={product} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 42vw, 78vw" />
            </li>
          ))}
        </SwipeRail>
      </div>
    </section>
  );
}

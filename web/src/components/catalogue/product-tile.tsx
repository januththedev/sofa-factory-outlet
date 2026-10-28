import { TLink } from '@/components/site/transition';
import { Picture } from '@/components/picture';
import type { ProductCard } from '@/lib/catalogue/queries';
import { formatLkr } from '@/lib/money';

/** One link per tile; colour dots and photographs are decorative. */
export function ProductTile({
  product,
  priority = false,
  sizes = '(min-width: 1024px) 25vw, 50vw',
}: { product: ProductCard; priority?: boolean; sizes?: string }) {
  const price = product.priceMinor !== null
    ? `${product.priceFrom ? 'From ' : ''}${formatLkr(product.priceMinor)}`
    : 'Price on request';
  // White-background cut-outs sit on the page via multiply; lifestyle photos fill the card.
  const fit = product.image?.cutout ? 'object-contain mix-blend-multiply' : 'object-cover';
  return (
    <article className="group relative">
      <TLink href={product.href} data-cursor="view" className="block min-h-11 min-w-11">
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-paper">
          {product.image ? (
            <Picture
              data={product.image}
              alt=""
              sizes={sizes}
              priority={priority}
              imgClassName={`h-full w-full ${fit}`}
            />
          ) : null}
          {product.hoverImage ? (
            <Picture
              data={product.hoverImage}
              alt=""
              sizes={sizes}
              imgClassName={`absolute inset-0 h-full w-full opacity-0
                [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100
                ${product.hoverImage.cutout ? 'object-contain mix-blend-multiply' : 'object-cover'}`}
            />
          ) : null}
          {product.isNew ? (
            <span className="absolute left-2 top-2 rounded-full bg-maroon px-3 py-1 text-xs text-bone">New</span>
          ) : null}
        </div>
        <div className="mt-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-lg leading-snug">{product.name}</h3>
            <p className="mt-1 text-base text-mute">{price}</p>
          </div>
          {product.colours.length ? (
            <ul className="mt-2 flex gap-1" aria-hidden="true">
              {product.colours.slice(0, 4).map((colour) => (
                <li key={colour.id} className="h-3 w-3 rounded-full border border-line"
                  style={{ backgroundColor: colour.hex }} />
              ))}
            </ul>
          ) : null}
        </div>
      </TLink>
    </article>
  );
}

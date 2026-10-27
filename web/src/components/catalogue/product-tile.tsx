import { TLink } from '@/components/site/transition';
import { Picture } from '@/components/picture';
import type { ProductCard } from '@/lib/catalogue/queries';
import { formatLkr } from '@/lib/money';

/** Product card for grids: photo (with a second photo on hover when there is one), name, colour and price. */
export function ProductTile({ product, priority = false, sizes = '(min-width: 1024px) 25vw, 50vw' }: { product: ProductCard; priority?: boolean; sizes?: string }) {
  const price = product.priceMinor ? `${product.priceFrom ? 'From ' : ''}${formatLkr(product.priceMinor)}` : 'Price on request';
  // White-background cut-outs sit on the page via multiply; lifestyle photos fill the card.
  const fit = product.image?.cutout ? 'object-contain mix-blend-multiply' : 'object-cover';
  return (
    <article className="group relative">
      <TLink href={product.href} data-cursor="view" className="block" aria-label={product.name}>
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-paper">
          {product.image ? (
            <Picture
              data={product.image}
              sizes={sizes}
              priority={priority}
              imgClassName={`h-full w-full ${fit} transition duration-700 ease-out ${product.hoverImage ? 'group-hover:opacity-0' : 'group-hover:scale-[1.04]'}`}
            />
          ) : null}
          {product.hoverImage ? (
            <Picture
              data={product.hoverImage}
              sizes={sizes}
              imgClassName={`absolute inset-0 h-full w-full ${product.hoverImage.cutout ? 'object-contain mix-blend-multiply' : 'object-cover'} opacity-0 transition duration-700 ease-out group-hover:opacity-100`}
            />
          ) : null}
          {product.isNew ? <span className="absolute left-3 top-3 rounded-full bg-maroon px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wider text-bone">New</span> : null}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-xl leading-snug">{product.name}</h3>
            <p className="mt-1 text-sm text-mute">{price}</p>
          </div>
          {product.colours.length ? (
            <ul className="mt-1.5 flex shrink-0 -space-x-1" aria-label={`Colour: ${product.colours.map((c) => c.name).join(', ')}`}>
              {product.colours.slice(0, 4).map((colour) => (
                <li key={colour.id} className="h-4 w-4 rounded-full ring-2 ring-bone" style={{ backgroundColor: colour.hex }} title={colour.name} />
              ))}
            </ul>
          ) : null}
        </div>
      </TLink>
    </article>
  );
}

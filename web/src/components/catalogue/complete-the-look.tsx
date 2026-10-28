import type { ReactNode } from 'react';
import { ProductTile } from '@/components/catalogue/product-tile';
import { suggestFor } from '@/lib/colour/engine';

// CONTRACT STUB. Owner: "colour-engine" agent. Keep the export name and props.
// Server component: asks suggestFor() for pieces that go with `anchors` and renders them
// as tiles, each with the one-line reason from the colour engine. Renders nothing when there are none.
export async function CompleteTheLook(props: {
  anchors: Array<{ productId: number; variantId?: number }>;
  heading?: string;
  limit?: number;
}): Promise<ReactNode> {
  const suggestions = await suggestFor({ anchors: props.anchors, limit: props.limit });
  if (suggestions.length === 0) return null;

  return (
    <section aria-labelledby="complete-the-look-heading" className="py-12 sm:py-16">
      <h2 id="complete-the-look-heading"
        className="font-display text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1] text-ink">
        {props.heading ?? 'Complete the look'}
      </h2>
      <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4
        lg:grid lg:grid-cols-4 lg:gap-6">
        {suggestions.map((suggestion) => (
          <div key={suggestion.product.id} className="w-[76%] shrink-0 snap-start lg:w-auto">
            <ProductTile product={suggestion.product} sizes="(min-width: 1024px) 25vw, 70vw" />
            <p className="mt-3 text-base leading-relaxed text-mute">{suggestion.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

import { Sofa } from 'lucide-react';
import { Picture } from '@/components/picture';
import { cn } from '@/lib/cn';
import type { ItemView } from '@/lib/admin/bookings';
import type { PictureData } from '@/lib/images/urls';

/** A small square product photo; white-background cut-outs blend in, other photos fill the square. */
export function ItemThumb({
  image,
  alt,
  className,
}: {
  image: PictureData | null;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative block size-12 shrink-0 overflow-hidden rounded-lg border border-line bg-paper',
        className,
      )}
    >
      {image ? (
        <Picture
          data={image}
          sizes="64px"
          alt={alt}
          placeholder={false}
          className="block size-full"
          imgClassName={cn('size-full', image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover')}
        />
      ) : (
        <span className="grid size-full place-items-center text-mute">
          <Sofa className="size-5" aria-hidden />
        </span>
      )}
    </span>
  );
}

export const itemAlt = (item: Pick<ItemView, 'name' | 'colourName'>) =>
  item.colourName ? `${item.name}, ${item.colourName}` : item.name;

/** Up to three overlapping photos and "N pieces", for a table cell or a card. */
export function ItemStack({ items, pieces }: { items: ItemView[]; pieces: number }) {
  if (items.length === 0) return <span className="text-mute">No pieces chosen</span>;
  const shown = items.slice(0, 3);
  const more = items.length - shown.length;
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3">
        {shown.map((item) => (
          <ItemThumb key={item.id} image={item.image} alt={itemAlt(item)} className="size-10 ring-2 ring-paper" />
        ))}
      </div>
      <span className="text-base sm:text-sm">
        {pieces} {pieces === 1 ? 'piece' : 'pieces'}
        {more > 0 ? <span className="text-mute"> (+{more} more)</span> : null}
      </span>
    </div>
  );
}

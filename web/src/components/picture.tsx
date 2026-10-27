import type { PictureData } from '@/lib/images/urls';

type PictureProps = {
  data: PictureData;
  /** The `sizes` attribute, e.g. "(min-width: 1024px) 33vw, 100vw". */
  sizes: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** Above-the-fold images (the LCP candidate): eager + high fetch priority. */
  priority?: boolean;
  /** Blurred placeholder behind photos; turn off for cut-outs with transparency. */
  placeholder?: boolean;
};

/**
 * Serves the AVIF/WebP widths generated at upload time. A plain <picture>
 * instead of next/image, because every size already exists in storage.
 */
export function Picture({ data, sizes, alt, className, imgClassName, priority = false, placeholder = true }: PictureProps) {
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={data.avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={data.webpSrcSet} sizes={sizes} />
      <img
        src={data.src}
        width={data.width}
        height={data.height}
        alt={alt ?? data.alt}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={imgClassName}
        style={
          placeholder && data.blur
            ? { backgroundImage: `url(${data.blur})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      />
    </picture>
  );
}

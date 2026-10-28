'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import MarkdownIt from 'markdown-it';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { saveProductAction } from '@/app/admin/(panel)/products/actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Label, Select, Textarea } from '@/components/ui/field';
import type { ProductInput } from '@/lib/admin/products';
import { evaluateSeoChecklist } from '@/lib/admin/seo-checklist';
import { classifyHex } from '@/lib/colour/classify';
import type { ImageRef } from '@/lib/db/schema/types';

type Category = {
  id: number;
  name: string;
};

type Props = {
  initial: ProductInput;
  categories: Category[];
  mediaBaseUrl: string;
};

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
const editorSchema = z.custom<ProductInput>((value) => {
  if (!value || typeof value !== 'object') return false;
  const product = value as Partial<ProductInput>;
  return typeof product.name === 'string'
    && product.name.trim().length >= 2
    && typeof product.slug === 'string'
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(product.slug)
    && typeof product.categoryId === 'number'
    && product.categoryId > 0
    && ['draft', 'published', 'hidden'].includes(product.status ?? '')
    && Array.isArray(product.variants);
}, 'Complete the required product fields.');

const slugify = (value: string) => value.toLowerCase().trim()
  .replace(/[^a-z0-9]+/gu, '-')
  .replace(/^-|-$/gu, '');

export function ProductEditor({ initial, categories, mediaBaseUrl }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.id));
  const [uploadId] = useState(() => String(initial.id ?? `temporary-${crypto.randomUUID()}`));
  const form = useForm<ProductInput>({
    resolver: zodResolver(editorSchema),
    defaultValues: initial,
  });
  const variants = useFieldArray({ control: form.control, name: 'variants' });
  const values = useWatch({
    control: form.control,
    compute: (formValues) => formValues,
  });
  const descriptionHtml = useMemo(() => markdown.render(values.descriptionMd ?? ''), [values.descriptionMd]);
  const images = values.variants.flatMap((variant) => variant.images);
  const seo = evaluateSeoChecklist({
    name: values.name,
    seoTitle: values.seoTitle ?? null,
    seoDescription: values.seoDescription ?? null,
    photoCount: images.length,
    photosWithAlt: images.filter((image) => image.alt.trim()).length,
    descriptionMd: values.descriptionMd,
    priceMinor: values.priceMinor,
    tags: values.tags,
  });

  function classify(index: number, hex: string) {
    try {
      const result = classifyHex(hex);
      form.setValue(`variants.${index}.hex`, hex.toUpperCase());
      form.setValue(`variants.${index}.family`, result.family);
      form.setValue(`variants.${index}.tone`, result.tone);
      form.setValue(`variants.${index}.warmth`, result.warmth);
    } catch {
      setMessage('Enter a six-digit hex colour.');
    }
  }

  async function upload(index: number, files: FileList | null) {
    if (!files?.length) return;
    const current = form.getValues(`variants.${index}.images`);
    if (current.length + files.length > 12) {
      setMessage('Each colour can have up to 12 photos.');
      return;
    }
    const data = new FormData();
    data.set('kind', 'products');
    data.set('id', uploadId);
    data.set('alt', form.getValues(`variants.${index}.colourName`) || form.getValues('name'));
    Array.from(files).forEach((file) => data.append('files', file));
    setMessage('Uploading photos…');
    const response = await fetch('/api/admin/upload/', { method: 'POST', body: data });
    const result = await response.json() as { ok: boolean; images?: ImageRef[]; error?: string };
    if (!result.ok || !result.images) {
      setMessage(result.error ?? 'Upload failed.');
      return;
    }
    form.setValue(`variants.${index}.images`, [...current, ...result.images], { shouldDirty: true });
    setMessage('Photos uploaded.');
  }

  function samplePhoto(index: number, image: HTMLImageElement, event: React.MouseEvent<HTMLImageElement>) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const x = Math.floor((event.nativeEvent.offsetX / image.clientWidth) * image.naturalWidth);
    const y = Math.floor((event.nativeEvent.offsetY / image.clientHeight) * image.naturalHeight);
    try {
      const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
      const hex = `#${[red, green, blue]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')}`;
      classify(index, hex);
    } catch {
      setMessage('This photo cannot be sampled because its source blocks canvas access.');
    }
  }

  function updateImage(index: number, imageIndex: number, patch: Partial<ImageRef>) {
    const current = [...form.getValues(`variants.${index}.images`)];
    current[imageIndex] = { ...current[imageIndex], ...patch };
    form.setValue(`variants.${index}.images`, current, { shouldDirty: true });
  }

  function moveImage(index: number, imageIndex: number, direction: -1 | 1) {
    const current = [...form.getValues(`variants.${index}.images`)];
    const target = imageIndex + direction;
    if (target < 0 || target >= current.length) return;
    [current[imageIndex], current[target]] = [current[target], current[imageIndex]];
    form.setValue(`variants.${index}.images`, current, { shouldDirty: true });
  }

  const submit = form.handleSubmit(async (value) => {
    setMessage('Saving…');
    const result = await saveProductAction(value);
    if (!result.ok) {
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, errors]) => {
          form.setError(field as keyof ProductInput, { message: errors[0] });
        });
      }
      setMessage(result.error);
      return;
    }
    setMessage('Saved.');
    router.replace(`/admin/products/${result.id}/`);
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-paper p-5 md:grid-cols-2">
        <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
          <Input
            id="name"
            {...form.register('name', {
              onChange: (event) => {
                if (!slugEdited) form.setValue('slug', slugify(event.target.value));
              },
            })}
          />
        </Field>
        <Field label="Slug" htmlFor="slug" hint="Changing this creates a permanent redirect.">
          <Input id="slug" {...form.register('slug', { onChange: () => setSlugEdited(true) })} />
        </Field>
        <Field label="Category" htmlFor="category">
          <Select id="category" {...form.register('categoryId', { valueAsNumber: true })}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" {...form.register('status')}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </Select>
        </Field>
        <Field label="Short description" htmlFor="short" className="md:col-span-2">
          <Textarea id="short" {...form.register('shortDescription')} />
        </Field>
        <Field label="Long description (Markdown)" htmlFor="description" className="md:col-span-2">
          <Textarea id="description" rows={10} {...form.register('descriptionMd')} />
        </Field>
        <div
          className="prose rounded-xl bg-bone p-4 md:col-span-2"
          aria-label="Description preview"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
        <Field label="Selling points" htmlFor="selling">
          <Textarea id="selling" {...form.register('sellingPoints')} />
        </Field>
        <Field label="Tags (comma separated)" htmlFor="tags">
          <Input
            id="tags"
            value={values.tags.join(', ')}
            onChange={(event) => form.setValue(
              'tags',
              event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
              { shouldDirty: true },
            )}
          />
        </Field>
        <Field label="Material" htmlFor="material">
          <Input id="material" {...form.register('material')} />
        </Field>
        <Field label="Shape" htmlFor="shape">
          <Input id="shape" {...form.register('shape')} />
        </Field>
        <Field label="Seats" htmlFor="seats">
          <Input
            id="seats"
            type="number"
            {...form.register('seats', { setValueAs: (value) => value === '' ? null : Number(value) })}
          />
        </Field>
        <Field label="Price in rupees" htmlFor="price" hint="Leave blank for price on request.">
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={values.priceMinor === null ? '' : values.priceMinor / 100}
            onChange={(event) => form.setValue(
              'priceMinor',
              event.target.value === '' ? null : Math.round(Number(event.target.value) * 100),
              { shouldDirty: true },
            )}
          />
        </Field>
        <Field label="Compare-at price in rupees" htmlFor="compare">
          <Input
            id="compare"
            type="number"
            min="0"
            step="0.01"
            value={values.compareAtMinor == null ? '' : values.compareAtMinor / 100}
            onChange={(event) => form.setValue(
              'compareAtMinor',
              event.target.value === '' ? null : Math.round(Number(event.target.value) * 100),
              { shouldDirty: true },
            )}
          />
        </Field>
        <div className="flex flex-wrap gap-6 md:col-span-2">
          <Label><input type="checkbox" {...form.register('priceFrom')} /> From price</Label>
          <Label><input type="checkbox" {...form.register('featured')} /> Featured</Label>
          <Label><input type="checkbox" {...form.register('noindex')} /> Noindex</Label>
        </div>
      </section>
      <section className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
        <h2 className="font-display text-2xl">Dimensions in centimetres</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(['widthCm', 'depthCm', 'heightCm', 'seatHeightCm'] as const).map((key) => (
            <Field key={key} label={key.replace('Cm', '')} htmlFor={key}>
              <Input
                id={key}
                type="number"
                step="0.1"
                {...form.register(`dimensions.${key}`, {
                  setValueAs: (value) => value === '' ? undefined : Number(value),
                })}
              />
            </Field>
          ))}
          <Field label="Note" htmlFor="dimensionNote">
            <Input id="dimensionNote" {...form.register('dimensions.note')} />
          </Field>
        </div>
      </section>
      <section className="space-y-5">
        <div className="flex justify-between">
          <h2 className="font-display text-2xl">Colour variants</h2>
          <Button
            variant="ghost"
            onClick={() => variants.append({
              colourName: '',
              hex: '#808080',
              images: [],
              inStock: true,
              isDefault: false,
              sortOrder: variants.fields.length,
            })}
          >
            Add colour
          </Button>
        </div>
        {variants.fields.map((variant, index) => (
          <div key={variant.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Field label="Colour name" htmlFor={`colour-${index}`}>
                <Input id={`colour-${index}`} {...form.register(`variants.${index}.colourName`)} />
              </Field>
              <Field label="Hex" htmlFor={`hex-${index}`}>
                <Input
                  id={`hex-${index}`}
                  type="color"
                  {...form.register(`variants.${index}.hex`, {
                    onChange: (event) => classify(index, event.target.value),
                  })}
                />
              </Field>
              <Field label="Family" htmlFor={`family-${index}`}>
                <Input id={`family-${index}`} {...form.register(`variants.${index}.family`)} />
              </Field>
              <Field label="Tone" htmlFor={`tone-${index}`}>
                <Select id={`tone-${index}`} {...form.register(`variants.${index}.tone`)}>
                  <option value="light">Light</option>
                  <option value="mid">Mid</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
              <Field label="Warmth" htmlFor={`warmth-${index}`}>
                <Select id={`warmth-${index}`} {...form.register(`variants.${index}.warmth`)}>
                  <option value="warm">Warm</option>
                  <option value="cool">Cool</option>
                  <option value="neutral">Neutral</option>
                </Select>
              </Field>
              <div className="flex items-end gap-2">
                <Button variant="ghost" onClick={() => index > 0 && variants.swap(index, index - 1)}>↑</Button>
                <Button
                  variant="ghost"
                  onClick={() => index < variants.fields.length - 1 && variants.swap(index, index + 1)}
                >
                  ↓
                </Button>
                <Button variant="danger" onClick={() => variants.remove(index)}>Remove</Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <Label>
                <input type="checkbox" {...form.register(`variants.${index}.inStock`)} /> In stock
              </Label>
              <Label>
                <input type="checkbox" {...form.register(`variants.${index}.isDefault`)} /> Default colour
              </Label>
            </div>
            <label
              className="mt-4 block rounded-xl border border-dashed border-line p-4 text-sm"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void upload(index, event.dataTransfer.files);
              }}
            >
              <Label htmlFor={`photos-${index}`}>Drop photos here or choose files (up to 12)</Label>
              <Input
                id={`photos-${index}`}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => void upload(index, event.target.files)}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              {values.variants[index]?.images.map((image, imageIndex) => (
                <div key={image.key} className="w-40 space-y-2 rounded-xl border border-line p-2">
                  <Image
                    src={`${mediaBaseUrl}/${image.key}/${image.widths[0]}.webp`}
                    alt={image.alt}
                    width={160}
                    height={96}
                    unoptimized
                    crossOrigin="anonymous"
                    className="h-24 w-full cursor-crosshair rounded object-cover"
                    onClick={(event) => samplePhoto(index, event.currentTarget, event)}
                  />
                  <Input
                    aria-label={`Alt text for photo ${imageIndex + 1}`}
                    value={image.alt}
                    onChange={(event) => updateImage(index, imageIndex, { alt: event.target.value })}
                  />
                  <Select
                    aria-label={`Photo flag ${imageIndex + 1}`}
                    value={image.flag ?? ''}
                    onChange={(event) => updateImage(index, imageIndex, {
                      flag: event.target.value === '' ? null : event.target.value as 'borrowed' | 'licence',
                    })}
                  >
                    <option value="">No flag</option>
                    <option value="borrowed">Borrowed</option>
                    <option value="licence">Licence check</option>
                  </Select>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => moveImage(index, imageIndex, -1)}>←</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveImage(index, imageIndex, 1)}>→</Button>
                    <Button
                      size="sm"
                      variant="link"
                      onClick={() => form.setValue(
                        `variants.${index}.images`,
                        form.getValues(`variants.${index}.images`)
                          .filter((_, itemIndex) => itemIndex !== imageIndex),
                        { shouldDirty: true },
                      )}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-paper p-5 md:grid-cols-2">
        <Field label={`SEO title (${(values.seoTitle ?? '').length}/60)`} htmlFor="seoTitle">
          <Input id="seoTitle" {...form.register('seoTitle')} />
        </Field>
        <Field
          label={`SEO description (${(values.seoDescription ?? '').length}/160)`}
          htmlFor="seoDescription"
        >
          <Textarea id="seoDescription" {...form.register('seoDescription')} />
        </Field>
        <div className="rounded-xl border border-line p-4 md:col-span-2">
          <p className="text-sm text-good">sofafactoryoutlet.lk/product/{values.slug}/</p>
          <p className="text-xl text-blue-800">{values.seoTitle || values.name}</p>
          <p>{values.seoDescription}</p>
        </div>
        <div className="rounded-xl bg-bone p-4 md:col-span-2">
          <h2 className="font-display text-xl">SEO checklist: {seo.score} ({seo.passed}/{seo.total})</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {seo.checks.map((check) => (
              <li key={check.id} className={check.pass ? 'text-good' : 'text-bad'}>
                {check.pass ? '✓' : '○'} {check.label}: {check.detail}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div
        className={[
          'sticky bottom-4 flex items-center justify-end gap-4 rounded-full',
          'border border-line bg-paper/95 p-3 shadow',
        ].join(' ')}
      >
        <span aria-live="polite" className="text-sm text-mute">{message}</span>
        <Button type="submit" disabled={form.formState.isSubmitting}>Save product</Button>
      </div>
    </form>
  );
}

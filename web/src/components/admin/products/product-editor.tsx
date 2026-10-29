'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import MarkdownIt from 'markdown-it';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { editorSchema } from './editor-state';
import { hasUnsavedChanges } from './editor-state';
import { numberOrEmpty } from './editor-state';
import { PhotoUploader } from './photo-uploader';
import { useUnsavedWarning } from './use-unsaved-warning';
import { saveProductAction } from '@/app/admin/(panel)/products/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/field';
import { Label } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import type { ProductInput } from '@/lib/admin/products';
import { evaluateSeoChecklist } from '@/lib/admin/seo-checklist';
import { classifyHex } from '@/lib/colour/classify';


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
const slugify = (value: string) => value.toLowerCase().trim()
  .replace(/[^a-z0-9]+/gu, '-')
  .replace(/^-|-$/gu, '');

export function ProductEditor({ initial, categories, mediaBaseUrl }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [savedValues, setSavedValues] = useState(initial);
  const [uploads, setUploads] = useState(0);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.id));
  const [uploadId] = useState(() => String(initial.id ?? `temporary-${crypto.randomUUID()}`));
  const form = useForm<ProductInput>({
    resolver: zodResolver(editorSchema),
    defaultValues: initial,
    mode: 'onBlur',
  });
  const variants = useFieldArray({ control: form.control, name: 'variants' });
  const values = useWatch({
    control: form.control,
    compute: (formValues) => formValues,
  });
  const dirty = hasUnsavedChanges(savedValues, values);
  useUnsavedWarning(dirty || uploads > 0);
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

  function focusProblem(name: string) {
    const input = document.getElementsByName(name)[0];
    const section = input?.closest('details');
    if (section) section.open = true;
    input?.focus();
    input?.scrollIntoView({ block: 'center' });
  }

  const submit = form.handleSubmit(async (value) => {
    if (uploads > 0) {
      setMessage('Wait for your photos to finish uploading, then save.');
      return;
    }
    setMessage('Saving…');
    let result: Awaited<ReturnType<typeof saveProductAction>>;
    try {
      result = await saveProductAction(value);
    } catch {
      setMessage('The product could not be saved. Your changes are kept. Please try again.');
      return;
    }
    if (!result.ok) {
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, errors]) => {
          form.setError(field as keyof ProductInput, { message: errors[0] });
        });
      }
      setMessage(result.error);
      const first = Object.keys(result.fieldErrors ?? {})[0];
      if (first) focusProblem(first);
      return;
    }
    form.reset(value);
    setSavedValues(value);
    setMessage('Saved.');
    router.replace(`/admin/products/${result.id}/`);
    router.refresh();
  }, (errors) => {
    setMessage('Check the fields listed below, then save again.');
    const first = Object.keys(errors)[0];
    if (first) focusProblem(first);
  });

  return (
    <form onSubmit={submit} className="min-w-0 space-y-6 pb-28 max-md:[&_input[type=checkbox]]:size-11">
      {Object.keys(form.formState.errors).length > 0 ? (
        <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-bad p-4">
          <p>Check these fields, then save again:</p>
          <ul>
            {Object.entries(form.formState.errors).map(([name, error]) => (
              <li key={name}>
                <button type="button" className="min-h-11 min-w-11 text-left text-bad underline" onClick={() => {
                  focusProblem(name);
                }}>
                  {typeof error.message === 'string' ? error.message : `Check ${name}.`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <details open className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
        <summary className="min-h-11 cursor-pointer font-display text-2xl">Basics</summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
          <Input autoComplete="off" enterKeyHint="next"
            id="name"
            {...form.register('name', {
              onChange: (event) => {
                if (!slugEdited) form.setValue('slug', slugify(event.target.value));
              },
            })}
          />
        </Field>
        <Field label="Slug" htmlFor="slug" hint="Changing this creates a permanent redirect.">
          <Input autoComplete="off" enterKeyHint="next" id="slug" {...form.register('slug', { onChange: () => setSlugEdited(true) })} />
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
        <Field label="Short description" htmlFor="short" className="lg:col-span-2">
          <Textarea autoComplete="off" enterKeyHint="enter" id="short" {...form.register('shortDescription')} />
        </Field>
        <Field label="Long description (Markdown)" htmlFor="description" className="lg:col-span-2">
          <Textarea autoComplete="off" enterKeyHint="enter" id="description" rows={10} {...form.register('descriptionMd')} />
        </Field>
        <div
          className="prose rounded-xl bg-bone p-4 lg:col-span-2"
          aria-label="Description preview"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
        <Field label="Selling points" htmlFor="selling">
          <Textarea autoComplete="off" enterKeyHint="enter" id="selling" {...form.register('sellingPoints')} />
        </Field>
        <Field label="Tags (comma separated)" htmlFor="tags">
          <Input autoComplete="off" enterKeyHint="next"
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
          <Input autoComplete="off" enterKeyHint="next" id="material" {...form.register('material')} />
        </Field>
        <Field label="Shape" htmlFor="shape">
          <Input autoComplete="off" enterKeyHint="next" id="shape" {...form.register('shape')} />
        </Field>
        <Field label="Seats" htmlFor="seats">
          <Input autoComplete="off" enterKeyHint="next"
            id="seats"
            type="number"
            {...form.register('seats', { setValueAs: (value) => numberOrEmpty(value, null) })}
          />
        </Field>
        <Field label="Price in rupees" htmlFor="price" hint="Leave blank for price on request.">
          <Input autoComplete="off" enterKeyHint="next"
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
          <Input autoComplete="off" enterKeyHint="next"
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
        <div className="flex flex-wrap gap-6 lg:col-span-2">
          <Label><input type="checkbox" {...form.register('priceFrom')} /> From price</Label>
          <Label><input type="checkbox" {...form.register('featured')} /> Featured</Label>
          <Label><input type="checkbox" {...form.register('noindex')} /> Noindex</Label>
        </div>
        </div>
      </details>
      <details open className="space-y-4 rounded-xl border border-line bg-paper p-4">
        <summary className="min-h-11 cursor-pointer font-display text-2xl">Photos</summary>
        {variants.fields.length === 0 ? <p>Add a colour in Colours before choosing photos.</p> : null}
        {variants.fields.map((variant, index) => (
          <PhotoUploader
            key={variant.id}
            id={`photos-${variant.id}`}
            uploadId={uploadId}
            alt={values.variants[index]?.colourName || values.name}
            images={values.variants[index]?.images ?? []}
            mediaBaseUrl={mediaBaseUrl}
            onBusy={(busy) => setUploads((current) => current + (busy ? 1 : -1))}
            onImages={(next) => form.setValue(`variants.${index}.images`, next, { shouldDirty: true })}
            onUploaded={(next) => form.setValue(
              `variants.${index}.images`,
              [...form.getValues(`variants.${index}.images`), ...next],
              { shouldDirty: true },
            )}
          />
        ))}
      </details>
      <details open className="space-y-5 rounded-xl border border-line bg-paper p-4">
        <summary className="min-h-11 cursor-pointer font-display text-2xl">Colours</summary>
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-display text-2xl">Colour variants</h2>
          <Button
            variant="ghost"
            disabled={uploads > 0}
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
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <Field label="Colour name" htmlFor={`colour-${index}`}>
                <Input autoComplete="off" enterKeyHint="next" id={`colour-${index}`} {...form.register(`variants.${index}.colourName`)} />
              </Field>
              <Field label="Hex" htmlFor={`hex-${index}`}>
                <Input autoComplete="off" enterKeyHint="next"
                  id={`hex-${index}`}
                  type="color"
                  {...form.register(`variants.${index}.hex`, {
                    onChange: (event) => classify(index, event.target.value),
                  })}
                />
              </Field>
              <Field label="Family" htmlFor={`family-${index}`}>
                <Input autoComplete="off" enterKeyHint="next" id={`family-${index}`} {...form.register(`variants.${index}.family`)} />
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
              <div className="flex flex-wrap items-end gap-2">
                <Button variant="ghost" disabled={uploads > 0} aria-label={`Move colour ${index + 1} up`}
                  onClick={() => index > 0 && variants.swap(index, index - 1)}>↑</Button>
                <Button
                  variant="ghost"
                  disabled={uploads > 0}
                  aria-label={`Move colour ${index + 1} down`}
                  onClick={() => index < variants.fields.length - 1 && variants.swap(index, index + 1)}
                >
                  ↓
                </Button>
                <Button variant="danger" disabled={uploads > 0} onClick={() => {
                  if (window.confirm('Remove this colour and its photos?')) variants.remove(index);
                }}>Remove</Button>
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
          </div>
        ))}
      </details>
      <details open className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
        <summary className="min-h-11 cursor-pointer font-display text-2xl">Details</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(['widthCm', 'depthCm', 'heightCm', 'seatHeightCm'] as const).map((key) => (
            <Field key={key} label={key.replace('Cm', '')} htmlFor={key}>
              <Input autoComplete="off" enterKeyHint="next"
                id={key}
                type="number"
                step="0.1"
                {...form.register(`dimensions.${key}`, {
                  setValueAs: (value) => numberOrEmpty(value, undefined),
                })}
              />
            </Field>
          ))}
          <Field label="Note" htmlFor="dimensionNote">
            <Input autoComplete="off" enterKeyHint="next" id="dimensionNote" {...form.register('dimensions.note')} />
          </Field>
        </div>
      </details>
      <details open className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
        <summary className="min-h-11 cursor-pointer font-display text-2xl">SEO</summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <Field label={`SEO title (${(values.seoTitle ?? '').length}/60)`} htmlFor="seoTitle">
          <Input autoComplete="off" enterKeyHint="next" id="seoTitle" {...form.register('seoTitle')} />
        </Field>
        <Field
          label={`SEO description (${(values.seoDescription ?? '').length}/160)`}
          htmlFor="seoDescription"
        >
          <Textarea autoComplete="off" enterKeyHint="enter" id="seoDescription" {...form.register('seoDescription')} />
        </Field>
        <div className="rounded-xl border border-line p-4 lg:col-span-2">
          <p className="text-base sm:text-sm text-good">sofafactoryoutlet.lk/product/{values.slug}/</p>
          <p className="text-xl text-blue-800">{values.seoTitle || values.name}</p>
          <p>{values.seoDescription}</p>
        </div>
        <div className="rounded-xl bg-bone p-4 lg:col-span-2">
          <h2 className="font-display text-xl">SEO checklist: {seo.score} ({seo.passed}/{seo.total})</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {seo.checks.map((check) => (
              <li key={check.id} className={check.pass ? 'text-good' : 'text-bad'}>
                {check.pass ? '✓' : '○'} {check.label}: {check.detail}
              </li>
            ))}
          </ul>
        </div>
        </div>
      </details>
      <div
        data-sticky-bar
        className={[
          'sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl',
          'border border-line bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow',
        ].join(' ')}
      >
        <div aria-live="polite" className="min-w-0 text-base sm:text-sm">
          <p>{dirty ? 'Unsaved changes' : 'Saved'}</p>
          <p>{message}</p>
        </div>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="size-11 accent-maroon"
            checked={values.status === 'published'}
            onChange={(event) => form.setValue('status', event.target.checked ? 'published' : 'draft', {
              shouldDirty: true,
            })} />
          Publish
        </label>
        <Button type="submit" disabled={form.formState.isSubmitting || uploads > 0}>Save product</Button>
      </div>
    </form>
  );
}

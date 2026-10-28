'use client';

import Image from 'next/image';
import { Picture } from '@/components/picture';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Label } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import type { ImageRef } from '@/lib/db/schema/types';
import { movePhoto } from './editor-state';
import { updateUpload } from './editor-state';
import type { UploadState } from './editor-state';

const responseSchema = z.object({
  ok: z.boolean(),
  images: z.array(z.object({
    key: z.string(),
    alt: z.string(),
    widths: z.array(z.number().int().positive()).min(1),
    w: z.number(),
    h: z.number(),
    blur: z.string().optional(),
    dominant: z.string().optional(),
    source: z.string().optional(),
    cutout: z.boolean().optional(),
    flag: z.enum(['borrowed', 'licence']).nullable().optional(),
  })).optional(),
});

function sendPhoto(data: FormData, progress: (value: number) => void): Promise<ImageRef[]> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/admin/upload/');
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100));
    };
    request.onerror = () => reject(new Error('Connection lost. Choose this photo again to retry.'));
    request.ontimeout = () => reject(new Error('This photo took too long. Choose it again to retry.'));
    request.onload = () => {
      try {
        const result = responseSchema.safeParse(JSON.parse(request.responseText));
        if (request.status < 200 || request.status >= 300 || !result.success || !result.data.ok) {
          reject(new Error('This photo could not be uploaded. Try a JPEG, PNG or WebP photo.'));
          return;
        }
        if (!result.data.images?.length) {
          reject(new Error('No photo was received. Choose this photo again to retry.'));
          return;
        }
        resolve(result.data.images);
      } catch {
        reject(new Error('The upload could not be read. Choose this photo again to retry.'));
      }
    };
    request.send(data);
  });
}

export function PhotoUploader({
  id,
  uploadId,
  alt,
  images,
  mediaBaseUrl,
  onImages,
  onUploaded,
  onBusy,
}: {
  id: string;
  uploadId: string;
  alt: string;
  images: ImageRef[];
  mediaBaseUrl: string;
  onImages: (images: ImageRef[]) => void;
  onUploaded: (images: ImageRef[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [queue, setQueue] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const previews = useRef<string[]>([]);

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function choose(files: FileList | null) {
    if (!files?.length || locked.current) return;
    if (images.length + files.length > 12) {
      setMessage('Each colour can have up to 12 photos. Choose fewer files.');
      return;
    }
    locked.current = true;
    setBusy(true);
    onBusy(true);
    const entries = Array.from(files).map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { file, item: {
        id: crypto.randomUUID(),
        name: file.name,
        preview,
        progress: 0,
        status: 'queued' as const,
      } };
    });
    setQueue((current) => [...current, ...entries.map((entry) => entry.item)]);
    setMessage('Uploading photos. Keep this page open.');
    try {
      for (const { file, item } of entries) {
        try {
          if (!file.type.startsWith('image/')) throw new Error('Choose an image from your camera or gallery.');
          setQueue((current) => updateUpload(current, item.id, { status: 'uploading' }));
          const data = new FormData();
          data.set('kind', 'products');
          data.set('id', uploadId);
          data.set('alt', alt);
          data.append('files', file);
          const uploaded = await sendPhoto(data, (progress) => {
            setQueue((current) => updateUpload(current, item.id, { progress }));
          });
          onUploaded(uploaded);
          setQueue((current) => updateUpload(current, item.id, { status: 'saved', progress: 100 }));
        } catch (error) {
          setQueue((current) => updateUpload(current, item.id, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Choose this photo again to retry.',
          }));
        }
      }
      setMessage('Finished checking photos. Uploaded photos are kept; choose any failed files again to retry.');
    } finally {
      locked.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  function patch(index: number, change: Partial<ImageRef>) {
    onImages(images.map((image, position) => position === index ? { ...image, ...change } : image));
  }

  return (
    <div className="min-w-0 space-y-4">
      <label
        htmlFor={id}
        className="block space-y-2 rounded-xl border border-dashed border-line p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void choose(event.dataTransfer.files);
        }}
      >
        <span className="block font-medium">Choose photos for {alt || 'this colour'} (up to 12)</span>
        <Input
          id={id}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(event) => {
            void choose(event.target.files);
            event.target.value = '';
          }}
        />
      </label>
      <p role="status" aria-live="polite">{message}</p>
      <ul aria-live="polite" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {queue.filter((item) => item.status !== 'saved').map((item) => (
          <li key={item.id} className="min-w-0 space-y-2 rounded-xl border border-line p-3">
            <Image src={item.preview} alt={item.name} width={240} height={160} unoptimized
              className="h-32 w-full rounded-lg object-contain" />
            <p className="break-all text-base sm:text-sm">{item.name}</p>
            {item.status === 'failed' ? <p className="text-bad">{item.error}</p> : (
              <>
                <progress className="w-full" max={100} value={item.progress} aria-label={`Upload ${item.name}`} />
                <p
                  className="text-base sm:text-sm">
                  {item.status === 'queued' ? 'Waiting' : `${item.progress}% uploaded`}
                </p>
              </>
            )}
          </li>
        ))}
      </ul>
      <ul aria-live="polite" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.key} className="min-w-0 space-y-3 rounded-xl border border-line p-3">
            <Picture
              data={{
                src: `${mediaBaseUrl}/${image.key}/${image.widths[0]}.webp`,
                avifSrcSet: image.widths.map((width) =>
                  `${mediaBaseUrl}/${image.key}/${width}.avif ${width}w`).join(', '),
                webpSrcSet: image.widths.map((width) =>
                  `${mediaBaseUrl}/${image.key}/${width}.webp ${width}w`).join(', '),
                width: image.w,
                height: image.h,
                alt: image.alt,
                cutout: image.cutout ?? false,
              }}
              sizes="(max-width: 639px) 100vw, 240px"
              imgClassName={image.cutout
                ? 'h-36 w-full rounded-lg object-contain mix-blend-multiply'
                : 'h-36 w-full rounded-lg object-cover'}
            />
            <Label htmlFor={`${id}-alt-${index}`}>Alt text for photo {index + 1}</Label>
            <Input id={`${id}-alt-${index}`} value={image.alt}
              onChange={(event) => patch(index, { alt: event.target.value })} />
            <Label htmlFor={`${id}-flag-${index}`}>Photo flag {index + 1}</Label>
            <Select id={`${id}-flag-${index}`} value={image.flag ?? ''}
              onChange={(event) => patch(index, {
                flag: event.target.value === '' ? null : event.target.value as 'borrowed' | 'licence',
              })}>
              <option value="">No flag</option>
              <option value="borrowed">Borrowed</option>
              <option value="licence">Licence check</option>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" disabled={busy || index === 0}
                aria-label={`Move photo ${index + 1} up`}
                onClick={() => onImages(movePhoto(images, index, index - 1))}>
                Up
              </Button>
              <Button size="sm" variant="ghost" disabled={busy || index === images.length - 1}
                aria-label={`Move photo ${index + 1} down`}
                onClick={() => onImages(movePhoto(images, index, index + 1))}>
                Down
              </Button>
              <Button size="sm" variant="subtle" disabled={busy || index === 0}
                onClick={() => onImages(movePhoto(images, index, 0))}>
                {index === 0 ? 'Main photo' : 'Make main photo'}
              </Button>
              <Button size="sm" variant="link" disabled={busy} onClick={() => {
                if (window.confirm('Delete this photo from the product?')) {
                  onImages(images.filter((_, position) => position !== index));
                }
              }}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
      {images.length === 0 && !busy ? <p>No photos yet. Choose photos from your camera or gallery.</p> : null}
    </div>
  );
}

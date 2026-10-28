'use client';

import { useState } from 'react';
import { updateCategoryImageAction } from '@/app/admin/(panel)/categories/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import type { ImageRef } from '@/lib/db/schema/types';

type Props = {
  categoryId: number;
  slug: string;
  disabled: boolean;
};

export function CategoryImageUpload({ categoryId, slug, disabled }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function upload() {
    if (!file || pending) return;
    const data = new FormData();
    data.set('kind', 'categories');
    data.set('id', slug);
    data.set('alt', `${slug.replaceAll('-', ' ')} category`);
    data.append('files', file);
    setMessage('Uploading…');
    setPending(true);
    try {
    const response = await fetch('/api/admin/upload/', { method: 'POST', body: data });
    const result = await response.json() as { ok: boolean; images?: ImageRef[]; error?: string };
    const image = result.images?.[0];
    if (!result.ok || !image) {
      setMessage(result.error ?? 'Upload failed.');
      return;
    }
    const saved = await updateCategoryImageAction(categoryId, image);
    setMessage(saved.ok ? 'Category image saved.' : saved.error ?? 'Could not save the category image.');
    } catch {
      setMessage('This photo could not be uploaded. Please choose it again and retry.');
    } finally {
      setPending(false);
    }
  }

  if (disabled) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-3 md:col-span-2">
      <label className="grow text-base sm:text-sm font-medium">
        Category image
        <Input
          className="mt-1"
          type="file"
          accept="image/*"
          disabled={pending}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <Button onClick={() => void upload()} disabled={!file || pending}>{pending ? 'Uploading…' : 'Upload'}</Button>
      <span className="text-base sm:text-sm text-mute" aria-live="polite">{message}</span>
    </div>
  );
}

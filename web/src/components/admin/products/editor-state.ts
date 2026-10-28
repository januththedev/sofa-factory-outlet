import { z } from 'zod';
import type { ProductInput } from '@/lib/admin/products';

export const editorSchema = z.custom<ProductInput>((value) => Boolean(value && typeof value === 'object'))
  .superRefine((product, context) => {
    if (!product || typeof product !== 'object') return;
    if (typeof product.name !== 'string' || product.name.trim().length < 2) {
      context.addIssue({ code: 'custom', path: ['name'], message: 'Enter a name with at least two letters.' });
    }
    if (typeof product.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(product.slug)) {
      context.addIssue({ code: 'custom', path: ['slug'], message: 'Use lowercase words separated by hyphens.' });
    }
    if (!Number.isInteger(product.categoryId) || product.categoryId < 1) {
      context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Choose a category.' });
    }
    if (!['draft', 'published', 'hidden'].includes(product.status)) {
      context.addIssue({ code: 'custom', path: ['status'], message: 'Choose a product status.' });
    }
    if (!Array.isArray(product.variants)) {
      context.addIssue({ code: 'custom', path: ['variants'], message: 'Check the colour variants.' });
    }
  });

export type UploadState = {
  id: string;
  name: string;
  preview: string;
  progress: number;
  status: 'queued' | 'uploading' | 'saved' | 'failed';
  error?: string;
};

export function updateUpload(
  queue: UploadState[],
  id: string,
  patch: Partial<Pick<UploadState, 'progress' | 'status' | 'error'>>,
): UploadState[] {
  return queue.map((item) => item.id === id ? {
    ...item,
    ...patch,
    progress: Math.max(0, Math.min(100, patch.progress ?? item.progress)),
  } : item);
}

export function movePhoto<T>(photos: readonly T[], from: number, to: number): T[] {
  const next = [...photos];
  if (!Number.isInteger(from) || !Number.isInteger(to)) return next;
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  const [photo] = next.splice(from, 1);
  next.splice(to, 0, photo);
  return next;
}

export function hasUnsavedChanges(saved: unknown, current: unknown): boolean {
  return JSON.stringify(saved) !== JSON.stringify(current);
}

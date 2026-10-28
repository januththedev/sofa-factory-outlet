import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { keyboardInset } from '@/components/admin/chat/keyboard-inset';
import { stepQuantity } from '@/components/admin/invoices/builder-state';
import { editorSchema } from '@/components/admin/products/editor-state';
import { hasUnsavedChanges } from '@/components/admin/products/editor-state';
import { movePhoto } from '@/components/admin/products/editor-state';
import { updateUpload } from '@/components/admin/products/editor-state';
import type { UploadState } from '@/components/admin/products/editor-state';

function upload(id: string): UploadState {
  return { id, name: `${id}.jpg`, preview: `blob:${id}`, progress: 0, status: 'queued' };
}

describe('independent photo upload state', () => {
  it('keeps successful and waiting photos when another file fails', () => {
    const original = [upload('first'), upload('second'), upload('third')];
    const saved = updateUpload(original, 'first', { status: 'saved', progress: 100 });
    const failed = updateUpload(saved, 'second', { status: 'failed', error: 'Try this photo again.' });
    expect(failed.map((item) => item.status)).toEqual(['saved', 'failed', 'queued']);
    expect(failed[0]).toBe(saved[0]);
    expect(failed[2]).toBe(original[2]);
    expect(original[1].error).toBeUndefined();
    expect(failed[1].error).toBe('Try this photo again.');
  });

  it('clamps progress and preserves the file and preview', () => {
    const queue = [upload('photo')];
    expect(updateUpload(queue, 'photo', { progress: 200 })[0].progress).toBe(100);
    expect(updateUpload(queue, 'photo', { progress: -10 })[0].progress).toBe(0);
    expect(updateUpload(queue, 'photo', { status: 'uploading', progress: 40 })[0]).toEqual({
      ...queue[0], status: 'uploading', progress: 40,
    });
    expect(queue[0].progress).toBe(0);
  });

  it('ignores a stale update for a missing file', () => {
    const queue = [upload('kept')];
    expect(updateUpload(queue, 'missing', { status: 'failed' })).toEqual(queue);
  });
});

describe('photo ordering and main photo', () => {
  it('moves photos up, down and to the main position without losing others', () => {
    const photos = ['one', 'two', 'three'];
    expect(movePhoto(photos, 1, 0)).toEqual(['two', 'one', 'three']);
    expect(movePhoto(photos, 0, 1)).toEqual(['two', 'one', 'three']);
    expect(movePhoto(photos, 2, 0)).toEqual(['three', 'one', 'two']);
    expect(photos).toEqual(['one', 'two', 'three']);
  });

  it.each([
    [-1, 0], [0, -1], [3, 0], [0, 3], [1, 1], [0.5, 1], [0, Number.NaN],
  ])('ignores invalid move %i to %i', (from, to) => {
    expect(movePhoto(['one', 'two', 'three'], from, to)).toEqual(['one', 'two', 'three']);
    expect(movePhoto([], from, to)).toEqual([]);
  });
});

describe('unsaved product detection', () => {
  const saved = { name: 'Sofa', status: 'draft', variants: [{ images: ['one', 'two'] }] };

  it('treats equivalent values and reverted edits as saved', () => {
    expect(hasUnsavedChanges(saved, JSON.parse(JSON.stringify(saved)))).toBe(false);
    const edited = { ...saved, name: 'Chair' };
    expect(hasUnsavedChanges(saved, edited)).toBe(true);
    expect(hasUnsavedChanges(saved, { ...edited, name: saved.name })).toBe(false);
  });

  it('detects publishing and nested photo changes', () => {
    expect(hasUnsavedChanges(saved, { ...saved, status: 'published' })).toBe(true);
    expect(hasUnsavedChanges(saved, { ...saved, variants: [{ images: ['two', 'one'] }] })).toBe(true);
    expect(hasUnsavedChanges(saved, { ...saved, variants: [{ images: ['one'] }] })).toBe(true);
  });

  it('uses the latest saved baseline', () => {
    const next = { ...saved, name: 'Updated sofa' };
    expect(hasUnsavedChanges(next, next)).toBe(false);
    expect(hasUnsavedChanges(next, saved)).toBe(true);
  });
});

describe('editor field validation', () => {
  const valid = { name: 'Sofa', slug: 'sofa', categoryId: 1, status: 'draft', variants: [] };

  it('accepts a valid product and keeps its other fields', () => {
    expect(editorSchema.parse({ ...valid, descriptionMd: 'Keep this text.' })).toEqual({
      ...valid, descriptionMd: 'Keep this text.',
    });
  });

  it.each([
    ['name', ''], ['slug', 'Invalid Slug'], ['categoryId', 0], ['status', 'invalid'], ['variants', null],
  ] as const)('points to the invalid %s field', (field, value) => {
    const result = editorSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it.each([null, undefined, 'text', 1])('rejects a non-product value %j', (value) => {
    expect(editorSchema.safeParse(value).success).toBe(false);
  });
});

describe('invoice quantity stepper', () => {
  it.each([
    ['1', -1, '1'],
    ['1', 1, '2'],
    ['3', -1, '2'],
    ['', 1, '1'],
    ['invalid', 1, '2'],
    ['Infinity', -1, '1'],
    ['2.5', 1, '3'],
  ] as const)('steps %s by %i to %s', (value, direction, expected) => {
    expect(stepQuantity(value, direction)).toBe(expected);
  });
});

describe('playground keyboard position', () => {
  it('adds only the portion hidden by the keyboard', () => {
    expect(keyboardInset(740, 440, 0)).toBe(300);
    expect(keyboardInset(740, 440, 30)).toBe(270);
  });

  it('uses zero when the layout resized or the keyboard is closed', () => {
    expect(keyboardInset(440, 440, 0)).toBe(0);
    expect(keyboardInset(740, 740, 0)).toBe(0);
    expect(keyboardInset(740, 800, 0)).toBe(0);
    expect(keyboardInset(Number.NaN, 440, 0)).toBe(0);
  });
});

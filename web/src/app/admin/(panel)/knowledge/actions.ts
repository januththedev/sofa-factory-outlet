'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  type ActionResult,
  answerGap,
  deleteFaq,
  deleteSynonym,
  describeError,
  dismissGap,
  type FormResult,
  importSynonyms,
  type PreviewResponse,
  previewKnowledge,
  rollbackToVersion,
  type RollbackResult,
  saveEdit,
  saveFaq,
  type SaveResult,
  saveSynonym,
  saveUpload,
  setDocumentEnabled,
  setFaqEnabled,
  type SynonymImportResult,
  type SynonymSaveResult,
} from '@/lib/admin/knowledge';
import { requireRole } from '@/lib/auth/session';
import { enableEmbeddings, reindexAll } from '@/lib/kb/api';
import { revalidateSettings } from '@/lib/revalidate';

// Every action starts with requireRole(). Uploads, deletes and edits are open to owner and staff;
// the embeddings switch changes how the whole bot searches, so it is owner-only.

const PATH = '/admin/knowledge';
const idSchema = z.number().int().positive();
const switchSchema = z.object({ id: idSchema, enabled: z.boolean() });
const embeddingModelSchema = z.object({
  model: z
    .string()
    .trim()
    .max(120, 'That model id is too long.')
    .regex(/^[A-Za-z0-9._:/@+-]*$/, 'Model ids look like vendor/model-name.'),
});

type FileInput = { fileName: string; text: string };
type FaqInput = { id?: number; question: string; alternatives: string; answer: string; tags: string; enabled: boolean };
type MessageResult = { ok: true; message: string } | { ok: false; error: string };

export async function previewKnowledgeAction(input: FileInput): Promise<PreviewResponse> {
  await requireRole('any');
  try {
    return await previewKnowledge(input);
  } catch (error) {
    return { ok: false, errors: [{ message: describeError(error, 'The file could not be checked.') }] };
  }
}

export async function saveUploadAction(input: FileInput): Promise<SaveResult> {
  await requireRole('any');
  try {
    const result = await saveUpload(input);
    if (result.ok) revalidatePath(PATH);
    return result;
  } catch (error) {
    return { ok: false, errors: [{ message: describeError(error, 'The file could not be saved.') }] };
  }
}

export async function saveEditAction(input: { slug: string; text: string }): Promise<SaveResult> {
  await requireRole('any');
  try {
    const result = await saveEdit(input);
    if (result.ok) revalidatePath(PATH);
    return result;
  } catch (error) {
    return { ok: false, errors: [{ message: describeError(error, 'The changes could not be saved.') }] };
  }
}

export async function setDocumentEnabledAction(input: { id: number; enabled: boolean }): Promise<ActionResult> {
  await requireRole('any');
  const parsed = switchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That switch could not be read.' };
  try {
    const changed = await setDocumentEnabled(parsed.data.id, parsed.data.enabled);
    if (!changed) return { ok: false, error: 'That version is no longer the current one. Reload the page.' };
    revalidatePath(PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function rollbackAction(input: { versionId: number }): Promise<RollbackResult> {
  await requireRole('any');
  const parsed = z.object({ versionId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That version could not be read.' };
  try {
    const result = await rollbackToVersion(parsed.data.versionId);
    if (result.ok) revalidatePath(PATH);
    return result;
  } catch (error) {
    return { ok: false, error: describeError(error, 'The roll back did not work.') };
  }
}

export async function saveFaqAction(input: FaqInput): Promise<FormResult> {
  await requireRole('any');
  const id = idSchema.optional().safeParse(input.id);
  if (!id.success) return { ok: false, error: 'That FAQ could not be read.', fieldErrors: {} };
  try {
    const result = await saveFaq(input, { id: id.data });
    if (!result.ok) return result;
    revalidatePath(PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error, 'The FAQ could not be saved.'), fieldErrors: {} };
  }
}

export async function deleteFaqAction(input: { id: number }): Promise<ActionResult> {
  await requireRole('any');
  const parsed = z.object({ id: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That FAQ could not be read.' };
  try {
    const deleted = await deleteFaq(parsed.data.id);
    revalidatePath(PATH);
    return deleted ? { ok: true } : { ok: false, error: 'That FAQ was already deleted.' };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function setFaqEnabledAction(input: { id: number; enabled: boolean }): Promise<ActionResult> {
  await requireRole('any');
  const parsed = switchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That switch could not be read.' };
  try {
    const changed = await setFaqEnabled(parsed.data.id, parsed.data.enabled);
    if (!changed) return { ok: false, error: 'That FAQ no longer exists.' };
    revalidatePath(PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function saveSynonymAction(input: { term: string; variants: string[] }): Promise<SynonymSaveResult> {
  await requireRole('any');
  try {
    const result = await saveSynonym(input);
    if (result.ok) revalidatePath(PATH);
    return result;
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deleteSynonymAction(input: { id: number }): Promise<ActionResult> {
  await requireRole('any');
  const parsed = z.object({ id: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That term could not be read.' };
  try {
    const deleted = await deleteSynonym(parsed.data.id);
    revalidatePath(PATH);
    return deleted ? { ok: true } : { ok: false, error: 'That term was already deleted.' };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function importSynonymsAction(input: { text: string }): Promise<SynonymImportResult> {
  await requireRole('any');
  const parsed = z.object({ text: z.string() }).safeParse(input);
  if (!parsed.success) return { ok: false, errors: [{ message: 'The file could not be read.' }] };
  try {
    const result = await importSynonyms(parsed.data.text);
    if (result.ok) revalidatePath(PATH);
    return result;
  } catch (error) {
    return { ok: false, errors: [{ message: describeError(error, 'The synonyms could not be imported.') }] };
  }
}

export async function answerGapAction(input: FaqInput & { gapId: number }): Promise<FormResult> {
  await requireRole('any');
  const gapId = idSchema.safeParse(input.gapId);
  if (!gapId.success) return { ok: false, error: 'That question could not be read.', fieldErrors: {} };
  try {
    const result = await answerGap(gapId.data, input);
    if (!result.ok) return result;
    revalidatePath(PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error, 'The answer could not be saved.'), fieldErrors: {} };
  }
}

export async function dismissGapAction(input: { gapId: number }): Promise<ActionResult> {
  await requireRole('any');
  const parsed = z.object({ gapId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That question could not be read.' };
  try {
    const dismissed = await dismissGap(parsed.data.gapId);
    revalidatePath(PATH);
    return dismissed ? { ok: true } : { ok: false, error: 'That question cannot be dismissed any more.' };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function enableEmbeddingsAction(input: { model: string }): Promise<MessageResult> {
  await requireRole('owner');
  const parsed = embeddingModelSchema.safeParse({ model: input.model });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the model id.' };
  try {
    const result = await enableEmbeddings(parsed.data.model);
    if (!result.ok) return { ok: false, error: result.error };
    revalidateSettings();
    revalidatePath(PATH);
    return {
      ok: true,
      message: `Embeddings are on (${result.dim} dimensions). Run Re-index so every document gets its embeddings.`,
    };
  } catch (error) {
    return { ok: false, error: describeError(error, 'Embeddings could not be turned on.') };
  }
}

export async function reindexAction(): Promise<MessageResult> {
  await requireRole('owner');
  try {
    const result = await reindexAll();
    revalidatePath(PATH);
    return { ok: true, message: `Re-indexed ${result.documents} documents (${result.chunks} chunks).` };
  } catch (error) {
    return { ok: false, error: describeError(error, 'The re-index did not finish.') };
  }
}

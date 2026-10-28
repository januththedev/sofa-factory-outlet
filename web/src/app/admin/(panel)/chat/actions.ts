'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { saveChatSettings, setMessageFlag } from '@/lib/admin/chat';
import {
  type ActionResult,
  describeError,
  type EvalView,
  type FormResult,
  runAndStoreEval,
  saveFaq,
  toEvalView,
} from '@/lib/admin/knowledge';
import { requireRole } from '@/lib/auth/session';
import { type ChatExplanation, explainChat } from '@/lib/chat/explain';

// Every action starts with requireRole(). The settings form is owner-only; everything else is open to staff.

const CHAT_PATH = '/admin/chat';
const KNOWLEDGE_PATH = '/admin/knowledge';
const idSchema = z.number().int().positive();
const questionSchema = z.object({
  message: z.string().trim().min(1, 'Type a question first.').max(600, 'Keep the question under 600 characters.'),
});

type GoldenResponse = { ok: true; run: EvalView } | { ok: false; error: string };
type ExplainResponse = { ok: true; explanation: ChatExplanation } | { ok: false; error: string };
type SettingsInput = Record<string, string>;
type SettingsResponse =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

/** Runs the golden set (retrieval only, no model calls) and stores it so the next run can be compared. */
export async function runGoldenTestAction(): Promise<GoldenResponse> {
  await requireRole('any');
  try {
    const run = toEvalView(await runAndStoreEval());
    revalidatePath(CHAT_PATH);
    revalidatePath(KNOWLEDGE_PATH);
    return { ok: true, run };
  } catch (error) {
    return { ok: false, error: describeError(error, 'The golden test could not run.') };
  }
}

/** The playground: one message through the pipeline with a throwaway conversation (nothing is logged). */
export async function explainChatAction(input: { message: string }): Promise<ExplainResponse> {
  await requireRole('any');
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Type a question first.' };
  try {
    return { ok: true, explanation: await explainChat(parsed.data.message) };
  } catch (error) {
    return { ok: false, error: describeError(error, 'The chatbot could not answer that just now.') };
  }
}

export async function flagMessageAction(input: { messageId: number; flagged: boolean }): Promise<ActionResult> {
  await requireRole('any');
  const parsed = z.object({ messageId: idSchema, flagged: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That message could not be read.' };
  try {
    const changed = await setMessageFlag(parsed.data.messageId, parsed.data.flagged);
    if (!changed) return { ok: false, error: 'That answer no longer exists.' };
    revalidatePath(CHAT_PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

/** "Flag / write FAQ": the corrected answer becomes an instant FAQ and the wrong answer is flagged. */
export async function writeFaqFromMessageAction(input: {
  messageId: number;
  question: string;
  alternatives: string;
  answer: string;
  tags: string;
}): Promise<FormResult> {
  await requireRole('any');
  const messageId = idSchema.safeParse(input.messageId);
  if (!messageId.success) return { ok: false, error: 'That message could not be read.', fieldErrors: {} };
  try {
    const result = await saveFaq({ ...input, enabled: true }, { source: 'admin' });
    if (!result.ok) return result;
    await setMessageFlag(messageId.data, true);
    revalidatePath(CHAT_PATH);
    revalidatePath(KNOWLEDGE_PATH);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error, 'The FAQ could not be saved.'), fieldErrors: {} };
  }
}

/** Owner only: model order, daily budget, per-session answers, rate limit, temperature and max tokens. */
export async function saveChatSettingsAction(input: SettingsInput): Promise<SettingsResponse> {
  await requireRole('owner');
  try {
    const result = await saveChatSettings(input);
    if (!result.ok) return result;
    revalidatePath(CHAT_PATH);
    return { ok: true, message: 'Chat settings saved. The chatbot uses them from its next message.' };
  } catch (error) {
    return { ok: false, error: describeError(error, 'The settings could not be saved.'), fieldErrors: {} };
  }
}

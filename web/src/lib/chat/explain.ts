import { notImplemented } from '../not-implemented';
import type { ChatContextInput } from './api';

// CONTRACT STUB. Owner: "chat-pipeline" agent. Keep these exports and signatures.
// Powers the admin playground: runs one message through the pipeline with a throwaway
// conversation (nothing is logged to the public conversation list) and returns the internals.

export type ChatExplanation = {
  intent: string;
  extracted: Record<string, unknown>;
  chunks: Array<{ headingPath: string; body: string; score: number }>;
  products: Array<{ id: number; name: string; score: number }>;
  /** the exact prompt that would be sent to the model, or null when the answer needs no model */
  prompt: string | null;
  answer: string;
  answeredBy: 'faq' | 'template' | 'model' | 'handoff' | 'fallback';
};

export const explainChat: (message: string, context?: ChatContextInput) => Promise<ChatExplanation> = async () => notImplemented('explainChat');

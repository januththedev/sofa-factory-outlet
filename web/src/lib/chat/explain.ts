import type { ChatContextInput } from './api';
import { getSettings } from '../settings/get';
import { assessConfidence } from './confidence';
import { extractDetails } from './extract';
import { findFaq } from './faq';
import { classifyIntent } from './intent';
import { normalise } from './normalise';
import { openRouter } from './openrouter';
import { buildPrompt } from './prompt';
import { retrieve } from './retrieve';
import { honestHandoff, templateFor } from './templates';
import { verifyAnswer } from './verify';

export type ChatExplanation = {
  intent: string;
  extracted: Record<string, unknown>;
  chunks: Array<{ headingPath: string; body: string; score: number }>;
  products: Array<{ id: number; name: string; score: number }>;
  prompt: string | null;
  answer: string;
  answeredBy: 'faq' | 'template' | 'model' | 'handoff' | 'fallback';
};

export const explainChat: (
  message: string,
  context?: ChatContextInput,
) => Promise<ChatExplanation> = async (message, context = {}) => {
  const query = normalise(message);
  const intent = classifyIntent(query, context);
  const extracted = extractDetails(query);
  const faq = await findFaq(query);
  if (faq) {
    return {
      intent,
      extracted,
      chunks: [],
      products: [],
      prompt: null,
      answer: faq.answer,
      answeredBy: 'faq',
    };
  }
  const result = await retrieve(query, intent, extracted, context);
  const template = templateFor(intent, result.products, result.pairReasons);
  const confidence = assessConfidence({
    productScores: result.productScores.map((item) => item.score),
    chunkScores: result.chunks.map((chunk) => chunk.score),
  });
  const prompt = !template && confidence.sufficient
    ? buildPrompt({
        question: message,
        intent,
        chunks: result.chunks,
        products: result.products,
        cart: context.cart,
      })
    : null;
  let answer = template ?? honestHandoff;
  let answeredBy: ChatExplanation['answeredBy'] = template ? 'template' : 'handoff';
  if (prompt) {
    try {
      const settings = await getSettings();
      const stream = await openRouter(prompt, settings.chat.models ?? undefined);
      if (stream) {
        answer = '';
        for await (const delta of stream.deltas) {
          answer += delta;
        }
        answer = verifyAnswer(answer, result.products);
        answeredBy = answer ? 'model' : 'fallback';
        if (!answer) {
          answer = honestHandoff;
        }
      } else {
        answeredBy = 'fallback';
      }
    } catch {
      answeredBy = 'fallback';
    }
  }
  return {
    intent,
    extracted,
    chunks: result.chunks.map((chunk) => ({
      headingPath: chunk.headingPath,
      body: chunk.body,
      score: chunk.score,
    })),
    products: result.products.map((product, index) => ({
      id: product.id,
      name: product.name,
      score: result.productScores[index]?.score ?? 0,
    })),
    prompt,
    answer,
    answeredBy,
  };
};

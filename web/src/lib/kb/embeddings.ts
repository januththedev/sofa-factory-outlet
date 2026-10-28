import { env } from '@/lib/env';

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  error?: { message?: string };
};

export async function embedTexts(texts: string[], model?: string): Promise<number[][]> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter embeddings are not configured: set OPENROUTER_API_KEY.');
  }
  const resolvedModel = model || env.OPENROUTER_EMBED_MODEL;
  if (!resolvedModel) {
    throw new Error('OpenRouter embeddings are not configured: choose an embedding model.');
  }
  if (texts.length === 0) return [];
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: resolvedModel, input: texts }),
  });
  const payload = await response.json() as EmbeddingResponse;
  if (!response.ok) {
    throw new Error(`OpenRouter embeddings failed: ${payload.error?.message ?? response.statusText}.`);
  }
  const ordered = [...(payload.data ?? [])].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  if (ordered.length !== texts.length || ordered.some((item) => !Array.isArray(item.embedding))) {
    throw new Error('OpenRouter embeddings returned an invalid response.');
  }
  return ordered.map((item) => item.embedding ?? []);
}

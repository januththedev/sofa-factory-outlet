import { chatModels, env } from '../env';
import { MODEL_OPTIONS } from './prompt';

export type ModelStream = {
  model: string;
  deltas: AsyncGenerator<string>;
};

type StreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
};

export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? '' : lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue;
      }
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }
      try {
        const text = (JSON.parse(data) as StreamChunk).choices?.[0]?.delta?.content;
        if (text) {
          yield text;
        }
      } catch {
        // A malformed SSE event should not terminate a usable stream.
      }
    }
    if (done) {
      break;
    }
  }
}

export async function openRouter(prompt: string, models?: string[]): Promise<ModelStream | null> {
  if (!env.OPENROUTER_API_KEY) {
    return null;
  }
  const candidates = models?.length ? models : chatModels();
  for (const model of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let keepTimer = false;
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: MODEL_OPTIONS.temperature,
          max_tokens: MODEL_OPTIONS.maxTokens,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        continue;
      }
      const source = parseSse(response.body);
      const first = await source.next();
      if (first.done || !first.value) {
        continue;
      }
      async function* deltas(): AsyncGenerator<string> {
        try {
          yield first.value;
          yield* source;
        } finally {
          clearTimeout(timer);
        }
      }
      keepTimer = true;
      return { model, deltas: deltas() };
    } catch {
      // Try the next configured model after network, timeout, or stream errors.
    } finally {
      if (!keepTimer) {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

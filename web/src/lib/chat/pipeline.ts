import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db';
import * as s from '../db/schema';
import type { Retrieved } from '../db/schema/chat';
import { notify } from '../notify/bell';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { getSettings, whatsappLink } from '../settings/get';
import type { SettingsMap } from '../settings/types';
import type { ChatEvent, ChatRequest, QuickReply } from './api';
import { modelBudgetAvailable } from './budget';
import { assessConfidence } from './confidence';
import { extractDetails } from './extract';
import { findFaq } from './faq';
import { classifyIntent } from './intent';
import { recordGap } from './log';
import { normalise } from './normalise';
import type { SynonymDictionary } from './normalise';
import { openRouter } from './openrouter';
import { buildPrompt } from './prompt';
import { retrieve } from './retrieve';
import { honestHandoff, templateFor } from './templates';
import { verifyAnswer } from './verify';

type AnsweredBy = 'faq' | 'template' | 'model' | 'handoff' | 'fallback';

async function safeSettings(): Promise<SettingsMap> {
  try {
    return await getSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function loadSynonyms(): Promise<SynonymDictionary> {
  try {
    const db = await getDb();
    const rows = await db.select().from(s.synonyms);
    const dictionary: SynonymDictionary = {};
    for (const row of rows) {
      for (const variant of row.variants) {
        dictionary[variant] = row.term;
      }
    }
    return dictionary;
  } catch {
    return {};
  }
}

export async function* pipeline(request: ChatRequest): AsyncGenerator<ChatEvent> {
  const startedAt = Date.now();
  const db = await getDb();
  let [conversation] = await db
    .select()
    .from(s.chatConversations)
    .where(and(
      eq(s.chatConversations.sessionId, request.sessionId),
      eq(s.chatConversations.visitorId, request.visitorId),
    ))
    .limit(1);

  if (!conversation) {
    [conversation] = await db
      .insert(s.chatConversations)
      .values({
        visitorId: request.visitorId,
        sessionId: request.sessionId,
        context: request.context ?? {},
      })
      .returning();
  } else if (request.context) {
    await db
      .update(s.chatConversations)
      .set({ context: request.context, lastMessageAt: new Date() })
      .where(eq(s.chatConversations.id, conversation.id));
  }

  const context = request.context ?? conversation.context;
  const query = normalise(request.message, await loadSynonyms());
  const intent = classifyIntent(query, context);
  const extracted = extractDetails(query);
  const explicitlyRequestsHandoff = /talk to (?:a )?person|human|whatsapp/.test(query);
  await db.insert(s.chatMessages).values({
    conversationId: conversation.id,
    role: 'user',
    text: request.message,
    intent,
    extracted,
  });

  let answer = '';
  let answeredBy: AnsweredBy = 'template';
  let model: string | undefined;
  let confidence = 1;
  let products: Awaited<ReturnType<typeof retrieve>>['products'] = [];
  let chunks: Awaited<ReturnType<typeof retrieve>>['chunks'] = [];
  let retrieved: Retrieved = {};
  const faq = await findFaq(query);

  if (explicitlyRequestsHandoff) {
    answer = honestHandoff;
    answeredBy = 'handoff';
  } else if (faq) {
    answer = faq.answer;
    answeredBy = 'faq';
    retrieved = { faqId: faq.id };
  } else {
    const result = await retrieve(query, intent, extracted, context);
    products = result.products;
    chunks = result.chunks;
    retrieved = {
      products: result.productScores,
      chunks: chunks.map((chunk) => ({ id: chunk.chunkId, score: chunk.score })),
    };
    const gate = assessConfidence({
      productScores: result.productScores.map((item) => item.score),
      chunkScores: chunks.map((chunk) => chunk.score),
    });
    confidence = gate.score;
    const settings = await safeSettings();
    answer = templateFor(intent, products, result.pairReasons, settings.business) ?? '';

    if (!answer && !gate.sufficient) {
      answer = honestHandoff;
      answeredBy = 'handoff';
      await recordGap(request.message);
    } else if (!answer) {
      const hasBudget = await modelBudgetAvailable(
        request.sessionId,
        settings.chat.dailyModelBudget,
        settings.chat.perSessionModelAnswers,
        settings.chat.bufferCalls,
      );
      if (hasBudget) {
        const recent = await db
          .select({ role: s.chatMessages.role, text: s.chatMessages.text })
          .from(s.chatMessages)
          .where(eq(s.chatMessages.conversationId, conversation.id))
          .orderBy(asc(s.chatMessages.id));
        const prompt = buildPrompt({
          question: request.message,
          intent,
          chunks,
          products,
          cart: context.cart,
          recent,
        });
        const stream = await openRouter(prompt, settings.chat.models ?? undefined);
        if (stream) {
          model = stream.model;
          for await (const delta of stream.deltas) {
            answer += delta;
          }
          answer = verifyAnswer(answer, products);
          if (answer) {
            answeredBy = 'model';
          } else {
            answer = honestHandoff;
            answeredBy = 'fallback';
            await recordGap(request.message);
          }
        } else {
          answer = honestHandoff;
          answeredBy = 'fallback';
          await recordGap(request.message);
        }
      } else {
        answer = honestHandoff;
        answeredBy = 'handoff';
        await recordGap(request.message);
      }
    }
  }

  const settings = await safeSettings();
  const summaryRows = await db
    .select({ role: s.chatMessages.role, text: s.chatMessages.text })
    .from(s.chatMessages)
    .where(eq(s.chatMessages.conversationId, conversation.id))
    .orderBy(asc(s.chatMessages.id));
  const summary = [
    'Chat summary:',
    ...summaryRows.slice(-5).map((message) => `${message.role}: ${message.text}`),
    `assistant: ${answer}`,
  ].join('\n');
  const whatsappUrl = settings.business.whatsapp.confirmed
    ? whatsappLink(settings.business.whatsapp.number, summary)
    : null;
  const chips: QuickReply[] = [];
  if (products.length > 0) {
    chips.push({ label: 'Show it in grey', action: 'send', payload: 'Show it in grey' });
    const product = products[0];
    const variantId = product.colours[0]?.id;
    chips.push({
      label: 'Add to cart',
      action: 'add_to_cart',
      payload: JSON.stringify({ productId: product.id, variantId }),
    });
  }
  chips.push(
    { label: 'Book a visit', action: 'book_visit', payload: '/book-visit/' },
    { label: 'Talk to a person', action: 'whatsapp', payload: whatsappUrl ?? undefined },
  );
  const isHandoff = answeredBy === 'handoff' || answeredBy === 'fallback';

  if (isHandoff) {
    await db
      .update(s.chatConversations)
      .set({ handoffAt: new Date() })
      .where(eq(s.chatConversations.id, conversation.id));
    await notify({
      type: 'handoff',
      title: 'Chat handoff requested',
      body: request.message,
      link: '/admin/chat/',
    });
  }

  yield { type: 'meta', conversationId: conversation.id, intent, answeredBy };
  if (products.length > 0) {
    yield { type: 'cards', products };
  }
  yield { type: 'delta', text: answer };
  yield { type: 'chips', items: chips };
  if (isHandoff && whatsappUrl) {
    yield { type: 'handoff', whatsappUrl };
  }
  const [assistant] = await db
    .insert(s.chatMessages)
    .values({
      conversationId: conversation.id,
      role: 'assistant',
      text: answer,
      intent,
      extracted,
      retrieved,
      confidence,
      answeredBy,
      model,
      latencyMs: Date.now() - startedAt,
    })
    .returning({ id: s.chatMessages.id });
  yield { type: 'done', messageId: assistant.id };
}

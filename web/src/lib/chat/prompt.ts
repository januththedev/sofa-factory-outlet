import type { ProductCard } from '../catalogue/queries';
import type { KbHit } from '../kb/api';
import type { ChatIntent } from './intent';
import { formatPrice } from './templates';

export type PromptInput = {
  question: string;
  intent: ChatIntent;
  chunks: KbHit[];
  products: ProductCard[];
  cart?: Array<{ productId: number; quantity: number }>;
  recent?: Array<{ role: string; text: string }>;
};

const examples: Record<ChatIntent, string[]> = {
  find_products: ['Here are the closest matches.', 'I found two pieces within that budget.'],
  product_question: ['The listed material is velvet.', 'That detail is not in the supplied facts.'],
  cart_pairing: ['These colours work well together.', 'Here are matching pieces.'],
  store_info: ['The confirmed address is in the facts.', 'I do not have confirmed hours.'],
  booking: ['You can book a showroom visit.', 'Choose an available time on the booking page.'],
  small_talk: ['Hello! How can I help with your room?', 'Happy to help.'],
  off_topic: ['I can help with furniture and visits.', 'The team can help with that directly.'],
};

export function buildPrompt(input: PromptInput): string {
  const facts = input.chunks
    .map((chunk, index) => `[F${index + 1}] ${chunk.headingPath}: ${chunk.body}`)
    .join('\n') || '(none)';
  const products = input.products
    .map((product, index) => {
      const material = product.material ?? 'material not listed';
      const colours = product.colours.map((colour) => colour.family).join('/') || 'colour not listed';
      const seats = product.seats ?? 'seats not listed';
      const price = formatPrice(product.priceMinor);
      return `[P${index + 1}] ${product.name} | ${material} | ${colours} | ${seats} seats | ${price}`;
    })
    .join('\n') || '(none)';
  const cart = input.cart?.map((item) => `${item.productId} x${item.quantity}`).join(', ') || '(empty)';
  const recent = (input.recent ?? [])
    .slice(-4)
    .map((turn) => `${turn.role}: ${turn.text}`)
    .join('\n') || '(none)';
  const examplesForIntent = examples[input.intent].map((example) => `- ${example}`).join('\n');
  return [
    'RULES: Answer only from FACTS and PRODUCTS. At most 80 words. Never state a price that is not '
      + 'listed. Prices are LKR. If facts are insufficient, say so.',
    `QUESTION: ${input.question}`,
    `FACTS:\n${facts}`,
    `PRODUCTS:\n${products}`,
    `CART: ${cart}`,
    `RECENT CHAT:\n${recent}`,
    `EXAMPLES:\n${examplesForIntent}`,
    'ANSWER:',
  ].join('\n\n');
}

export const MODEL_OPTIONS = { temperature: 0.2, maxTokens: 250 } as const;

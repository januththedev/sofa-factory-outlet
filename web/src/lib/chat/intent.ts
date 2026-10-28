import type { ChatContextInput } from './api';
export type ChatIntent =
  | 'find_products'
  | 'product_question'
  | 'cart_pairing'
  | 'store_info'
  | 'booking'
  | 'small_talk'
  | 'off_topic';
const has = (q: string, words: string[]) => words.some((word) => q.includes(word));
export function classifyIntent(query: string, context: ChatContextInput = {}): ChatIntent {
  if (context.cart?.length && has(query, ['pair', 'match', 'go with', 'cushion', 'rug', 'table'])) {
    return 'cart_pairing';
  }
  if (has(query, ['book', 'visit', 'appointment', 'showroom slot'])) {
    return 'booking';
  }
  if (has(query, [
    'address', 'location', 'where are', 'where is', 'open', 'hours', 'whatsapp', 'contact', 'delivery',
  ])) {
    return 'store_info';
  }
  const refersToProduct = has(query, [
    'this', 'it', 'clean', 'material', 'size', 'price', 'colour', 'warranty',
  ]);
  if (context.productId && (refersToProduct || query.split(' ').length < 7)) {
    return 'product_question';
  }
  if (has(query, [
    'sofa', 'chair', 'bed', 'table', 'furniture', 'l-shape', 'u-shape',
    'velvet', 'leather', 'under ', 'price',
  ])) {
    return 'find_products';
  }
  if (has(query, ['hello', 'hi', 'hey', 'thanks', 'thank you', 'good morning', 'good evening'])) {
    return 'small_talk';
  }
  return 'off_topic';
}

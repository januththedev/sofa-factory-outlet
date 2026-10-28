import { getPublishedCards } from '../catalogue/cached';
import type { ProductCard } from '../catalogue/queries';
import { searchProducts } from '../catalogue/search';
import { suggestFor } from '../colour/engine';
import { searchKnowledge, type KbHit } from '../kb/api';
import type { ChatContextInput } from './api';
import type { ExtractedDetails } from './extract';
import type { ChatIntent } from './intent';

export type Retrieval = {
  products: ProductCard[];
  productScores: Array<{ id: number; score: number }>;
  chunks: KbHit[];
  pairReasons: string[];
};

const tags: Record<ChatIntent, string[]> = {
  find_products: ['buying', 'products'],
  product_question: ['materials', 'care', 'products'],
  cart_pairing: ['colour', 'pairing'],
  store_info: ['store', 'delivery'],
  booking: ['booking'],
  small_talk: [],
  off_topic: [],
};

function matches(product: ProductCard, details: ExtractedDetails): boolean {
  return (!details.category || product.category.path === details.category)
    && (!details.colour || product.colours.some((colour) => colour.family === details.colour))
    && (!details.material || product.material === details.material)
    && (!details.shape || product.shape === details.shape)
    && (!details.seats || product.seats === details.seats)
    && (details.maxPrice === undefined
      || product.priceMinor === null
      || product.priceMinor <= details.maxPrice * 100);
}

export async function retrieve(
  query: string,
  intent: ChatIntent,
  details: ExtractedDetails,
  context: ChatContextInput = {},
): Promise<Retrieval> {
  let products: ProductCard[] = [];
  let pairReasons: string[] = [];
  if (intent === 'cart_pairing' && context.cart?.length) {
    try {
      const suggestions = await suggestFor({ anchors: context.cart, limit: 4 });
      products = suggestions.map((suggestion) => suggestion.product);
      pairReasons = suggestions.map((suggestion) => suggestion.reason);
    } catch {
      // Continue with knowledge retrieval.
    }
  } else if (intent === 'product_question' && context.productId) {
    try {
      products = (await getPublishedCards()).filter((product) => product.id === context.productId);
    } catch {
      products = [];
    }
  } else if (intent === 'find_products' || intent === 'product_question') {
    try {
      const result = await searchProducts({
        q: query,
        category: details.category,
        colour: details.colour ? [details.colour] : undefined,
        material: details.material ? [details.material] : undefined,
        shape: details.shape ? [details.shape] : undefined,
        seats: details.seats ? [details.seats] : undefined,
        maxPrice: details.maxPrice,
        pageSize: 4,
      });
      products = result.items.slice(0, 4);
    } catch {
      try {
        products = (await getPublishedCards()).filter((product) => matches(product, details)).slice(0, 4);
      } catch {
        products = [];
      }
    }
  }
  let chunks: KbHit[] = [];
  try {
    chunks = await searchKnowledge(query, { tags: tags[intent], limit: 3 });
  } catch {
    chunks = [];
  }
  return {
    products,
    productScores: products.map((product, index) => ({ id: product.id, score: 1 - index * 0.1 })),
    chunks,
    pairReasons,
  };
}

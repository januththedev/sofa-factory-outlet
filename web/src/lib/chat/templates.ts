import type { ProductCard } from '../catalogue/queries';
import type { BusinessSettings } from '../settings/types';
import type { ChatIntent } from './intent';

export function formatPrice(minor: number | null): string {
  if (minor === null) {
    return 'price on request';
  }
  return `Rs. ${Math.round(minor / 100).toLocaleString('en-LK')}`;
}

export function productTemplate(products: ProductCard[], description = 'matching'): string {
  const shown = products.slice(0, 4);
  if (shown.length === 0) {
    return '';
  }
  const noun = shown.length === 1 ? 'piece' : 'pieces';
  const verb = shown.length === 1 ? 'is' : 'are';
  const details = shown
    .map((product) => `${product.name} (${formatPrice(product.priceMinor)})`)
    .join(', ');
  return `Here ${verb} ${shown.length} ${description} ${noun}: ${details}.`;
}

export function storeTemplate(business?: BusinessSettings): string | null {
  if (!business) {
    return null;
  }
  const facts: string[] = [];
  if (business.address.confirmed) {
    facts.push([
      business.address.street,
      business.address.locality,
      business.address.city,
    ].filter(Boolean).join(', '));
  }
  if (business.whatsapp.confirmed && business.whatsapp.number) {
    facts.push(`WhatsApp ${business.whatsapp.number}`);
  }
  return facts.length > 0 ? `Showroom details: ${facts.join('. ')}.` : null;
}

export function templateFor(
  intent: ChatIntent,
  products: ProductCard[] = [],
  pairingReasons: string[] = [],
  business?: BusinessSettings,
): string | null {
  if (intent === 'find_products' && products.length > 0) {
    return productTemplate(products);
  }
  if (intent === 'cart_pairing' && products.length > 0) {
    const matches = products.slice(0, 4).map((product, index) => {
      const reason = pairingReasons[index];
      return reason ? `${product.name} — ${reason}` : product.name;
    });
    return `These pair well with your cart: ${matches.join(', ')}.`;
  }
  if (intent === 'store_info') {
    return storeTemplate(business);
  }
  if (intent === 'booking') {
    return 'You can choose a suitable showroom visit time on the booking page.';
  }
  if (intent === 'small_talk') {
    return 'Hello! I can help you find furniture or book a showroom visit.';
  }
  if (intent === 'off_topic') {
    return 'I can help with sofas, furniture and booking a visit.';
  }
  return null;
}

export const honestHandoff =
  "I'm not sure, but the team can tell you. You can message them on WhatsApp or book a visit.";

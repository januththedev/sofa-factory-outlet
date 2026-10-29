import { asc, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

export type PublicFaq = { question: string; answer: string; tags: string[] };

// Answers that still carry a placeholder (an unconfirmed address, hours, delivery terms) stay in the chatbot,
// which can hedge in conversation, but are not published as fact on a page search engines quote.
const UNCONFIRMED = /not (yet )?confirmed|placeholder|old site|reconfirm|to be confirmed/i;

export const isPublishable = (faq: { answer: string }): boolean => !UNCONFIRMED.test(faq.answer);

/** The FAQ section each tag belongs to on /faq/, in page order. */
export const FAQ_SECTIONS: Array<{ id: string; title: string; tags: string[] }> = [
  { id: 'buying', title: 'Buying a sofa', tags: ['buying', 'products', 'custom', 'colour'] },
  { id: 'materials', title: 'Materials and care', tags: ['materials', 'care'] },
  { id: 'prices', title: 'Prices and paying', tags: ['pricing'] },
  { id: 'visiting', title: 'Visiting and delivery', tags: ['booking', 'delivery', 'store_info', 'warranty'] },
  { id: 'about', title: 'About the factory', tags: ['about'] },
];

/** Enabled FAQs from the knowledge base, so edits in admin reach the public page. Cached for an hour. */
export const getPublicFaqs = unstable_cache(
  async (): Promise<PublicFaq[]> => {
    const db = await getDb();
    const rows = await db
      .select({ question: s.faqs.question, answer: s.faqs.answer, tags: s.faqs.tags })
      .from(s.faqs)
      .where(eq(s.faqs.enabled, true))
      .orderBy(asc(s.faqs.id));
    return rows.filter(isPublishable);
  },
  ['public-faqs-v1'],
  { tags: ['faqs'], revalidate: 3600 },
);

/** FAQs grouped into the page sections; an FAQ goes in the first section that claims one of its tags. */
export function groupFaqs(faqs: PublicFaq[]) {
  const used = new Set<PublicFaq>();
  return FAQ_SECTIONS.map((section) => {
    const items = faqs.filter((faq) => !used.has(faq) && faq.tags.some((tag) => section.tags.includes(tag)));
    items.forEach((faq) => used.add(faq));
    return { ...section, items };
  }).filter((section) => section.items.length > 0);
}

export const faqPageJsonLd = (faqs: PublicFaq[]): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
  })),
});

import { siteUrl } from '@/lib/env';
import { getPublicFaqs } from '@/lib/seo/public-faqs';
import { getSettings } from '@/lib/settings/get';

export const revalidate = 3600;

// A plain-text brief for AI assistants (llmstxt.org): who the business is, what it sells, how to buy, and the
// answers people ask most. Only confirmed settings and publishable FAQ answers go in, so nothing here is a guess.
export async function GET() {
  const [{ business }, faqs] = await Promise.all([getSettings(), getPublicFaqs()]);
  const base = siteUrl();
  const page = (path: string) => `${base}${path}`;

  const contact: string[] = [];
  if (business.address.confirmed) {
    const address = [business.address.street, business.address.locality, business.address.city].filter(Boolean).join(', ');
    contact.push(`- Showroom: ${address}, Sri Lanka`);
  } else {
    contact.push('- Showroom: Colombo, Sri Lanka (the address is confirmed when a visit is booked)');
  }
  if (business.phone.confirmed && business.phone.number) contact.push(`- Phone: ${business.phone.number}`);
  if (business.whatsapp.confirmed && business.whatsapp.number) contact.push(`- WhatsApp: ${business.whatsapp.number}`);
  if (business.email.confirmed && business.email.address) contact.push(`- Email: ${business.email.address}`);
  contact.push(`- Book a showroom visit: ${page('/book-visit/')}`);

  const answers = faqs.slice(0, 25).map((faq) => `### ${faq.question}\n${faq.answer}`).join('\n\n');

  const text = `# ${business.name}

> ${business.tagline} A Sri Lankan sofa and furniture maker that builds its pieces in its own Colombo workshop and sells them factory-direct, with no middleman. Customers see and sit on the pieces at the showroom before they buy; nothing is paid online.

## What they make
- Sofas: L-shape (corner and chaise), U-shape modular, 3+2+1 sofa sets, sets with wing chairs, Chesterfield-style sofas
- Upholstery: velvet, leather, corduroy and woven fabrics, in many colours
- Custom orders: the customer chooses the fabric, size, colour and layout
- Also: beds and bedding, chairs, tables, ottomans, cushions
- After-sales support for repairs, adjustments and questions

## How to buy
1. Browse the collection: ${page('/shop/')}
2. Book a showroom visit to see the pieces, fabrics and colours: ${page('/book-visit/')}
3. Prices and delivery are confirmed with the customer before a piece is made. Most pieces are priced on request.

## Contact
${contact.join('\n')}

## Key pages
- Home: ${page('/')}
- Shop (all products): ${page('/shop/')}
- Sofas: ${page('/sofas/')}
- L-shape sofas: ${page('/sofas/l-shape/')}
- U-shape sofas: ${page('/sofas/u-shape/')}
- Sofa sets: ${page('/sofas/sets/')}
- Sofa shop in Colombo: ${page('/sofa-shop-colombo/')}
- Custom-made sofas in Sri Lanka: ${page('/custom-sofas-sri-lanka/')}
- Questions and answers: ${page('/faq/')}
- The factory: ${page('/factory/')}
- About: ${page('/about-us/')}
- Visit the showroom: ${page('/visit/')}
- For interior designers and the trade: ${page('/trade/')}
- Buying guides: ${page('/guides/')}

## Common questions
${answers}
`;
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

import { siteUrl } from '@/lib/env';
import { getSetting } from '@/lib/settings/get';

export async function GET() {
  const business = await getSetting('business');
  const base = siteUrl();
  const text = `# ${business.name}\n\n${business.tagline}\n\n## Key pages\n- Home: ${base}/\n- Shop: ${base}/shop/\n- Factory: ${base}/factory/\n- Visit: ${base}/visit/\n- Book a visit: ${base}/book-visit/\n- Guides: ${base}/guides/\n`;
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

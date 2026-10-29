import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';
import { getSetting } from '@/lib/settings/get';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSetting('seo');
  const rules: MetadataRoute.Robots['rules'] = [
    {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/cart/',
        '/book-visit/done/',
        '/request-quote/',
      ],
    },
  ];
  if (seo.aiCrawlers === 'block') {
    for (const userAgent of [
      'GPTBot',
      'ClaudeBot',
      'CCBot',
      'Google-Extended',
      'PerplexityBot',
    ])
      rules.push({ userAgent, disallow: '/' });
  }
  return { rules, sitemap: `${siteUrl()}/sitemap.xml` };
}

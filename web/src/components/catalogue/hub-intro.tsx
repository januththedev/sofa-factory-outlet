import { TLink } from '@/components/site/transition';
import type { HubContent } from '../../../content/hubs';

export function HubIntro({ content }: { content: HubContent }) {
  return <section className="grid gap-10 py-10 lg:grid-cols-[1.5fr_1fr] lg:py-16"><div><p className="max-w-3xl text-lg leading-8 text-ink-2">{content.intro}</p></div><div>
    <h2 className="font-display text-2xl">Buying tips</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-ink-2">{content.tips.map((tip) => <li key={tip} className="border-l border-clay pl-4">{tip}</li>)}</ul>
    {content.guides.length ? <div className="mt-7"><h2 className="font-display text-xl">Helpful guides</h2><ul className="mt-3 space-y-2">{content.guides.map((slug) => <li key={slug}><TLink className="link-underline text-sm" href={`/guides/${slug}/`}>{slug.replace(/-/g, ' ')}</TLink></li>)}</ul></div> : null}
  </div></section>;
}

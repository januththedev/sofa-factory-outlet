import { TLink } from '@/components/site/transition';
import { getAllGuides, guidePath } from '@/lib/guides';
import type { HubContent } from '../../../content/hubs';

export async function HubIntro({ content }: { content: HubContent }) {
  // Link each guide by its real title; slugs with no published guide are left out.
  const all = await getAllGuides();
  const guides = content.guides.flatMap((slug) => {
    const guide = all.find((item) => item.slug === slug);
    return guide ? [guide] : [];
  });
  return (
    <section className="grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr] lg:py-16">
      <p className="max-w-prose text-base leading-8 text-ink-2 lg:text-lg">{content.intro}</p>
      <div>
        <h2 className="font-display text-2xl">Buying tips</h2>
        <ul className="mt-4 space-y-3 text-base leading-6 text-ink-2">
          {content.tips.map((tip) => <li key={tip} className="border-l border-clay pl-4">{tip}</li>)}
        </ul>
        {guides.length ? (
          <div className="mt-7">
            <h2 className="font-display text-xl">Helpful guides</h2>
            <ul className="mt-3 space-y-2">
              {guides.map((guide) => (
                <li key={guide.slug}>
                  <TLink className="link-underline inline-flex min-h-11 items-center text-base"
                    href={guidePath(guide.slug)}>
                    {guide.title}
                  </TLink>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

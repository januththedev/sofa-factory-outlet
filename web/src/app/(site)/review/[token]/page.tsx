import type { Metadata } from 'next';
import { Picture } from '@/components/picture';
import { ReviewForm } from '@/components/reviews/review-form';
import { ReviewNotice } from '@/components/reviews/review-notice';
import { cn } from '@/lib/cn';
import { pageMetadata } from '@/lib/seo/metadata';
import { getReviewFormContext, type ReviewFormContext } from '@/lib/seo/reviews';

// A review link is private to one customer: never prerendered, never indexed, and
// the address (which holds the token) is not passed on to other sites.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return {
    ...pageMetadata({
      title: 'Review your purchase',
      description: 'Tell us how your Sofa Factory Outlet purchase is working out.',
      path: '/review/',
      noindex: true,
    }),
    referrer: 'no-referrer',
  };
}

async function loadContext(token: string): Promise<ReviewFormContext> {
  try {
    return await getReviewFormContext(token);
  } catch (error) {
    console.error('[review] could not open a review link:', error);
    return { status: 'invalid' };
  }
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadContext(token);

  return (
    <div className="site-container pb-24 pt-32 lg:pb-32 lg:pt-44">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <header className="lg:col-span-5">
          <p className="eyebrow">Your review</p>
          <h1 className="mt-4 text-[clamp(2.2rem,4.6vw,4rem)] font-light leading-[1]">
            {context.status === 'ready' ? `How is your ${context.product.name}?` : 'Leave a review'}
          </h1>
          {context.status === 'ready' ? (
            <>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
                Thank you for visiting the showroom. A few honest words help other families choose, and the team
                checks every review before it appears.
              </p>
              {context.product.image ? (
                <div className="mt-8 aspect-[4/3] max-w-md overflow-hidden rounded-[var(--radius-card)] bg-paper">
                  <Picture
                    data={context.product.image}
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    imgClassName={cn(
                      'h-full w-full',
                      context.product.image.cutout ? 'object-contain mix-blend-multiply' : 'object-cover',
                    )}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </header>
        <div className="lg:col-span-7">
          {context.status === 'ready' ? (
            <ReviewForm token={token} productName={context.product.name} />
          ) : (
            <ReviewNotice status={context.status} />
          )}
        </div>
      </div>
    </div>
  );
}

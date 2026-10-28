import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/metadata';
import { getSettings, whatsappLink } from '@/lib/settings/get';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy notice',
  description:
    'What the Sofa Factory Outlet website collects, why we collect it, how long we keep it, ' +
    'and how to ask us to delete it.',
  path: '/privacy/',
});

const linkClass = 'link-underline text-maroon';

export default async function PrivacyPage() {
  const { business } = await getSettings();
  const whatsapp = whatsappLink(
    business.whatsapp.number,
    'Hello, I would like to ask about the data you hold about me.',
  );
  const email = business.email.address;
  const phone = business.phone.number;

  return (
    <div className="site-container">
      <article className="mx-auto max-w-3xl py-16 lg:py-24">
        <p className="eyebrow">Sofa Factory Outlet</p>
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,3.6rem)] font-light leading-[1.05]">
          Privacy notice
        </h1>
        <p className="mt-4 text-mute">
          A short, plain-English note about the information this website collects.
        </p>

        <p className="mt-6 rounded-[var(--radius-card)] border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-2">
          <strong>Draft:</strong> to be reviewed against Sri Lanka&apos;s Personal Data Protection Act
          before launch
        </p>

        <section className="mt-10">
          <h2 className="font-display text-2xl">What we collect when you browse</h2>
          <p className="mt-3 leading-relaxed text-ink-2">
            We keep a small, anonymous record of how the site is used: a random visitor ID, a session
            ID, the pages you view, your device type (phone, tablet or computer), your country and city
            as reported by our host, and the website that referred you. We do not store your IP address,
            and we never store your browser&apos;s user-agent string.
          </p>
          <p className="mt-3 leading-relaxed text-ink-2">
            The visitor ID sits in your browser&apos;s local storage and the session ID in its session
            storage. Neither contains your name or any other personal detail. Clearing your browser
            storage removes them.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">What we collect when you book or chat</h2>
          <p className="mt-3 leading-relaxed text-ink-2">
            If you book a showroom visit, we store the name, phone number, email address, city and notes
            you give us, along with the products and colours you picked and the time you chose. The
            booking is confirmed by our staff, and we use those details to prepare for your visit and to
            contact you about it.
          </p>
          <p className="mt-3 leading-relaxed text-ink-2">
            If you use the chat, we keep the messages in the conversation, together with the visitor and
            session IDs, so staff can follow up on questions and improve the answers. Please do not send
            payment details or other sensitive information through the chat.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Why we collect it</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink-2">
            <li>To answer questions, arrange showroom visits and follow up on bookings.</li>
            <li>
              To understand which pages and products people find useful, so we can improve the site.
            </li>
            <li>
              To see where visitors come from and which parts of the site need attention.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">How long we keep it</h2>
          <p className="mt-3 leading-relaxed text-ink-2">
            Raw browsing events are deleted after 90 days. After that, only daily totals remain, and
            they cannot be tied back to a visitor. Booking and invoice records are kept for as long as
            we need them for the visit and for our business records.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Where your information is handled</h2>
          <p className="mt-3 leading-relaxed text-ink-2">
            Our business is in Sri Lanka, and Sri Lanka&apos;s Personal Data Protection Act applies to
            the personal information we hold. This notice is a draft and has not yet been reviewed
            against that Act; we will publish the reviewed version before launch.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Asking us to delete your information</h2>
          <p className="mt-3 leading-relaxed text-ink-2">
            If you would like to see, correct or delete the personal information we hold about you,
            contact the showroom and tell us the name and phone number you used.
          </p>
          <ul className="mt-3 space-y-2 leading-relaxed text-ink-2">
            {whatsapp ? (
              <li>
                WhatsApp:{' '}
                <a href={whatsapp} className={linkClass} rel="noopener noreferrer" target="_blank">
                  message the showroom
                </a>
              </li>
            ) : null}
            {email ? (
              <li>
                Email:{' '}
                <a href={`mailto:${email}`} className={linkClass}>
                  {email}
                </a>
              </li>
            ) : null}
            {phone ? (
              <li>
                Phone:{' '}
                <a href={`tel:${phone.replace(/\s+/g, '')}`} className={linkClass}>
                  {phone}
                </a>
              </li>
            ) : null}
            <li>
              Or visit us at {business.address.street}, {business.address.locality},{' '}
              {business.address.city}.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Third parties we use</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink-2">
            <li>
              <strong>Vercel</strong> hosts the site and reports the country and city of a request.
            </li>
            <li>
              <strong>Cloudflare Turnstile</strong> checks that forms are filled in by a person, not a
              bot, when it is enabled.
            </li>
            <li>
              <strong>Google Maps</strong> shows the showroom map when you open it on the visit section.
            </li>
            <li>
              <strong>Resend</strong> sends booking and daily summary emails to our own staff inbox.
            </li>
            <li>
              <strong>OpenRouter</strong> answers open chat questions that our knowledge base cannot
              answer, using the question and the relevant shop context.
            </li>
          </ul>
          <p className="mt-3 leading-relaxed text-ink-2">
            These providers process data on our behalf under their own terms. We do not sell your
            information, and we do not use it for advertising.
          </p>
        </section>

        <p className="mt-12 border-t border-line pt-6 text-sm text-mute">
          Questions about this notice? Use the contact details above and ask for the owner.
        </p>
      </article>
    </div>
  );
}

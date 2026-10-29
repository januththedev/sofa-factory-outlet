import { CartDrawer } from '@/components/cart/cart-drawer';
import { ChatWidget } from '@/components/chat/chat-widget';
import { Cursor } from '@/components/site/cursor';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { SmoothScroll } from '@/components/site/smooth-scroll';
import { TransitionProvider } from '@/components/site/transition';
import { CartHydrator } from '@/lib/cart/store';
import { getSetting } from '@/lib/settings/get';
import { whatsappLink } from '@/lib/settings/get';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const business = await getSetting('business');
  const whatsapp = business.whatsapp.confirmed ? whatsappLink(business.whatsapp.number) : null;
  return (
    <TransitionProvider>
      <SmoothScroll />
      <Cursor />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header whatsapp={whatsapp} />
      <main id="main" className="site-main min-w-0">{children}</main>
      <Footer business={business} />
      <CartHydrator />
      <CartDrawer />
      <ChatWidget whatsapp={whatsapp} />
      <div className="grain" aria-hidden />
    </TransitionProvider>
  );
}

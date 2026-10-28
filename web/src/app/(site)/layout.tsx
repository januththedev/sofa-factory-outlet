import { CartDrawer } from '@/components/cart/cart-drawer';
import { ChatWidget } from '@/components/chat/chat-widget';
import { Cursor } from '@/components/site/cursor';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { Preloader } from '@/components/site/preloader';
import { SmoothScroll } from '@/components/site/smooth-scroll';
import { TransitionProvider } from '@/components/site/transition';
import { CartHydrator } from '@/lib/cart/store';
import { getSetting } from '@/lib/settings/get';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const business = await getSetting('business');
  return (
    <TransitionProvider>
      <Preloader />
      <SmoothScroll />
      <Cursor />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer business={business} />
      <CartHydrator />
      <CartDrawer />
      <ChatWidget />
      <div className="grain" aria-hidden />
    </TransitionProvider>
  );
}

import type { Metadata } from 'next';
import { CartPageBody } from '@/components/cart/cart-page-body';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'The pieces you have chosen. Nothing is paid online: book a showroom visit and your cart goes with the booking.',
  robots: { index: false },
};

// The shell is static; the cart itself lives in the browser, so only the client body reads it.
export default function CartPage() {
  return (
    <div className="site-container pb-24 pt-28 lg:pb-32 lg:pt-40">
      <h1 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-light leading-[1]">Your cart</h1>
      <p className="mt-5 max-w-xl text-ink-2">
        Nothing is paid online. Book a showroom visit and your cart goes with the booking, so the team knows what you would like to see.
      </p>
      <CartPageBody />
    </div>
  );
}

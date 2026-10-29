import type { Metadata } from 'next';
import { IntentLanding, type IntentContent } from '@/components/pages/intent-landing';
import { pageMetadata } from '@/lib/seo/metadata';

const CONTENT: IntentContent = {
  path: '/sofa-shop-colombo/',
  crumb: 'Sofa shop in Colombo',
  eyebrow: 'Sofa shop in Colombo',
  title: 'A Colombo sofa shop that makes its own sofas',
  lede:
    'Sofa Factory Outlet builds sofas in its own Colombo workshop and sells them straight from the factory, ' +
    'with no middleman. Visit the showroom to see and sit on the pieces before you choose.',
  points: [
    {
      title: 'Made in our own workshop',
      body: 'Every sofa is built at our Colombo workshop, on a strong wooden frame with high-density cushioning.',
    },
    {
      title: 'Factory-direct prices',
      body: 'You buy from the people who make it: no middleman and no showroom markup between you and the factory.',
    },
    {
      title: 'Made to your room',
      body: 'Choose the fabric, size, colour and layout. L-shape, U-shape, 3+2+1 sets and Chesterfield-style pieces.',
    },
    {
      title: 'Looked after afterwards',
      body: 'After-sales support for repairs, adjustments and questions continues once the sofa is home.',
    },
  ],
  stepsTitle: 'How buying works',
  steps: [
    'Browse the collection online, or book a time to visit the showroom.',
    'Sit on the pieces, compare fabrics and colours, and talk through sizes for your room.',
    'Prices and delivery are confirmed with you before anything is made. Nothing is paid online.',
  ],
  links: [
    { label: 'All sofas', href: '/sofas/' },
    { label: 'L-shape sofas', href: '/sofas/l-shape/' },
    { label: 'U-shape sofas', href: '/sofas/u-shape/' },
    { label: 'Sofa sets', href: '/sofas/sets/' },
    { label: 'Beds', href: '/beds/' },
    { label: 'Chairs', href: '/chairs/' },
  ],
  faqTags: ['store_info', 'booking', 'buying'],
  whatsappText: 'Hi, I am looking for a sofa in Colombo.',
};

export const metadata: Metadata = pageMetadata({
  title: 'Sofa shop in Colombo | Made in our own workshop',
  description:
    'Looking for a sofa shop in Colombo? Sofa Factory Outlet makes L-shape, U-shape and 3+2+1 sofas in its own ' +
    'Colombo workshop and sells factory-direct. Visit the showroom.',
  path: CONTENT.path,
});

export default function SofaShopColomboPage() {
  return <IntentLanding content={CONTENT} />;
}

import type { Metadata } from 'next';
import { IntentLanding, type IntentContent } from '@/components/pages/intent-landing';
import { pageMetadata } from '@/lib/seo/metadata';

const CONTENT: IntentContent = {
  path: '/custom-sofas-sri-lanka/',
  crumb: 'Custom sofas',
  eyebrow: 'Custom-made sofas in Sri Lanka',
  title: 'Custom-made sofas, built for your room',
  lede:
    'Choose the fabric, size, colour and layout, and the sofa is made to order in our own Colombo workshop. ' +
    'Bring your room measurements to the showroom and plan it with the team.',
  points: [
    {
      title: 'Your size',
      body: 'Bring the measurements of your room or wall. The team will confirm what can be built to fit.',
    },
    {
      title: 'Your fabric and colour',
      body: 'Velvet, leather, corduroy and woven fabrics, in many colours. See and feel them at the showroom.',
    },
    {
      title: 'Your layout',
      body: 'L-shape with a chaise, U-shape modular, 3+2+1 sets, sets with wing chairs or a Chesterfield style.',
    },
    {
      title: 'Built by the makers',
      body: 'Made in our own workshop on a strong wooden frame, and sold factory-direct with no middleman.',
    },
  ],
  stepsTitle: 'How a custom sofa is made',
  steps: [
    'Book a showroom visit or send your idea on WhatsApp, with your room measurements if you have them.',
    'Choose the shape, size, fabric and colour with the team, looking at the pieces in person.',
    'The price and delivery are confirmed with you, and the sofa is built only after you agree them.',
    'It is made in our Colombo workshop and delivered to your home.',
  ],
  links: [
    { label: 'L-shape sofas', href: '/sofas/l-shape/' },
    { label: 'U-shape sofas', href: '/sofas/u-shape/' },
    { label: 'Sofa sets', href: '/sofas/sets/' },
    { label: 'Velvet sofas', href: '/sofas/velvet/' },
    { label: 'Leather sofas', href: '/sofas/leather/' },
    { label: 'Fabric sofas', href: '/sofas/fabric/' },
  ],
  faqTags: ['custom', 'colour', 'materials'],
  whatsappText: 'Hi, I would like a custom-made sofa.',
};

export const metadata: Metadata = pageMetadata({
  title: 'Custom-made sofas in Sri Lanka | Your size, fabric and colour',
  description:
    'Custom sofas made to order in Colombo: choose the size, fabric, colour and layout. L-shape, U-shape and sofa ' +
    'sets built in our own workshop and sold factory-direct.',
  path: CONTENT.path,
});

export default function CustomSofasPage() {
  return <IntentLanding content={CONTENT} />;
}

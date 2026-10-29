import type { SettingsMap } from '@/lib/settings/types';

// What the client still has to confirm before the site can state it as fact
// (Plan.md, "Open questions for the client"). Pure: the dashboard gathers the
// input (see loadSetupInput in stats.ts) and this decides which items are open.

export type SetupItemId =
  | 'address'
  | 'phone'
  | 'whatsapp'
  | 'email'
  | 'social'
  | 'google-review'
  | 'hours'
  | 'visit-slots'
  | 'delivery'
  | 'invoice'
  | 'proof'
  | 'prices'
  | 'photos'
  | 'product-review'
  | 'reviews'
  | 'openrouter';

export type SetupGroup = 'details' | 'terms' | 'catalogue' | 'services';

export type SetupItem = {
  id: SetupItemId;
  group: SetupGroup;
  label: string;
  /** One plain sentence on what is missing; shown only while the item is open. */
  detail: string;
  /** Where to fix it. */
  href: string;
  done: boolean;
};

export type SetupInput = {
  settings: Pick<SettingsMap, 'business' | 'hours' | 'booking' | 'invoice' | 'delivery' | 'proof'>;
  counts: {
    publishedWithoutPrice: number;
    flaggedPhotos: number;
    productsNeedingReview: number;
    approvedReviews: number;
  };
  /** Whether each key is configured. Presence only: the values never reach this module. */
  services: { searchConsole: boolean; openRouter: boolean; resend: boolean };
};

export type SetupChecklist = {
  items: SetupItem[];
  total: number;
  done: number;
  remaining: number;
};

const SETTINGS = '/admin/settings/';
const filled = (value: string | null | undefined): boolean => Boolean(value && value.trim());
const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString('en-LK')} ${count === 1 ? one : many}`;

export function buildSetupChecklist(input: SetupInput): SetupChecklist {
  const { business, hours, booking, invoice, delivery, proof } = input.settings;
  const { counts, services } = input;
  const social = Object.values(business.social).some(filled);

  const items: SetupItem[] = [
    {
      id: 'address',
      group: 'details',
      label: 'Confirm the showroom address',
      detail: 'The address comes from the old site. Check it, then tick "Confirmed by the client".',
      href: `${SETTINGS}?tab=business`,
      done: business.address.confirmed,
    },
    {
      id: 'phone',
      group: 'details',
      label: 'Add the phone number',
      detail: filled(business.phone.number)
        ? 'Check the phone number and tick "Confirmed by the client".'
        : 'No phone number is set yet.',
      href: `${SETTINGS}?tab=business`,
      done: business.phone.confirmed && filled(business.phone.number),
    },
    {
      id: 'whatsapp',
      group: 'details',
      label: 'Confirm the WhatsApp number',
      detail: filled(business.whatsapp.number)
        ? 'The number comes from the old site. Check it and tick "Confirmed by the client".'
        : 'No WhatsApp number is set yet.',
      href: `${SETTINGS}?tab=business`,
      done: business.whatsapp.confirmed && filled(business.whatsapp.number),
    },
    {
      id: 'email',
      group: 'details',
      label: 'Add the public email address',
      detail: filled(business.email.address)
        ? 'Check the email address and tick "Confirmed by the client".'
        : 'No email address is set yet.',
      href: `${SETTINGS}?tab=business`,
      done: business.email.confirmed && filled(business.email.address),
    },
    {
      id: 'social',
      group: 'details',
      label: 'Add the social media links',
      detail: 'No Facebook, Instagram, TikTok or YouTube link is set yet.',
      href: `${SETTINGS}?tab=business`,
      done: social,
    },
    {
      id: 'google-review',
      group: 'details',
      label: 'Add the Google review link',
      detail: 'Without it the review request message cannot include a link.',
      href: `${SETTINGS}?tab=business`,
      done: filled(business.map.googleReviewUrl),
    },
    {
      id: 'hours',
      group: 'terms',
      label: 'Confirm the opening hours',
      detail: 'These hours are placeholders from the old site.',
      href: `${SETTINGS}?tab=hours`,
      done: hours.confirmed,
    },
    {
      id: 'visit-slots',
      group: 'terms',
      label: 'Confirm the visit slots',
      detail: 'Slot length and how many visits fit in each are placeholders.',
      href: `${SETTINGS}?tab=hours`,
      done: booking.confirmed,
    },
    {
      id: 'delivery',
      group: 'terms',
      label: 'Confirm delivery and warranty terms',
      detail: 'Delivery times, charges and the warranty wording are placeholders.',
      href: `${SETTINGS}?tab=delivery`,
      done: delivery.confirmed,
    },
    {
      id: 'invoice',
      group: 'terms',
      label: 'Confirm bank details and VAT',
      detail: 'Invoices print the bank details, VAT number and terms, which are not confirmed yet.',
      href: `${SETTINGS}?tab=invoice`,
      done: invoice.confirmed,
    },
    {
      id: 'proof',
      group: 'terms',
      label: 'Confirm the proof numbers',
      detail: 'Years trading, homes furnished and districts served are shown only once confirmed.',
      href: `${SETTINGS}?tab=delivery`,
      done: proof.confirmed,
    },
    {
      id: 'prices',
      group: 'catalogue',
      label: 'Add real prices',
      detail: `${plural(counts.publishedWithoutPrice, 'published product has', 'published products have')} no price, ` +
        'so search results cannot show one.',
      href: '/admin/products/?status=published',
      done: counts.publishedWithoutPrice === 0,
    },
    {
      id: 'photos',
      group: 'catalogue',
      label: 'Replace borrowed photos',
      detail: `${plural(counts.flaggedPhotos, 'photo is', 'photos are')} flagged as borrowed or to check.`,
      href: '/admin/products/',
      done: counts.flaggedPhotos === 0,
    },
    {
      id: 'product-review',
      group: 'catalogue',
      label: 'Review product notes',
      detail: `${plural(counts.productsNeedingReview, 'published product has', 'published products have')} ` +
        'open review notes.',
      href: '/admin/products/?status=published',
      done: counts.productsNeedingReview === 0,
    },
    {
      id: 'reviews',
      group: 'catalogue',
      label: 'Publish a first customer review',
      detail: 'No approved reviews yet. Ask a customer who visited, then approve their review.',
      href: '/admin/seo/?tab=reviews',
      done: counts.approvedReviews > 0,
    },
    {
      id: 'openrouter',
      group: 'services',
      label: 'Add the OpenRouter key',
      detail: 'Without it the chatbot answers only from FAQs and templates.',
      href: `${SETTINGS}?tab=chat#services`,
      done: services.openRouter,
    },
  ];

  const done = items.filter((item) => item.done).length;
  return { items, total: items.length, done, remaining: items.length - done };
}

/** The items still to do, in checklist order. */
export const openSetupItems = (checklist: SetupChecklist): SetupItem[] => checklist.items.filter((item) => !item.done);

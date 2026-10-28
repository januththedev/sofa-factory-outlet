import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { bookingCardModel } from '@/components/admin/bookings/card-model';
import { bookingContacts } from '@/components/admin/bookings/card-model';
import { primaryStatusAction } from '@/components/admin/bookings/card-model';
import { allowedTransitions } from '@/lib/admin/bookings';
import type { BookingListRow } from '@/lib/admin/bookings';
import type { BookingStatus } from '@/lib/db/schema/types';

const row: BookingListRow = {
  id: 42,
  reference: 'SFO-B-0042',
  status: 'new',
  visitDate: '2026-10-29',
  slotLabel: '10:00–11:00',
  customerId: 7,
  customerName: 'Test visitor',
  phone: '+94771234567',
  email: null,
  city: null,
  preferredContact: 'call',
  customerNotes: null,
  staffNotes: null,
  createdAt: new Date('2026-10-28T22:00:00Z'),
  source: { origin: 'Google', detail: 'Sofas' },
  items: [{
    id: 1,
    productId: null,
    name: 'Saved sofa',
    slug: null,
    colourName: 'Green',
    hex: '#008000',
    quantity: 3,
    priceMinor: null,
    lineMinor: null,
    image: null,
  }],
  pieces: 3,
};

describe('phone booking card model', () => {
  it('keeps the reference link, visit, source and product snapshots', () => {
    expect(bookingCardModel(row)).toMatchObject({
      href: '/admin/bookings/42/',
      reference: 'SFO-B-0042',
      name: 'Test visitor',
      date: expect.stringMatching(/^Thu,? 29 Oct 2026$/),
      slot: '10:00–11:00',
      status: 'new',
      source: row.source,
      items: row.items,
      pieces: 3,
      callHref: 'tel:+94771234567',
      whatsappHref: 'https://wa.me/94771234567',
      primaryAction: { value: 'contacted', label: 'Mark as contacted' },
    });
  });

  it('keeps a booking with no selected pieces usable', () => {
    const empty = bookingCardModel({ ...row, items: [], pieces: 0 });
    expect(empty.items).toEqual([]);
    expect(empty.pieces).toBe(0);
    expect(empty.href).toBe('/admin/bookings/42/');
  });

  it('uses a separate WhatsApp number and normalises the call number', () => {
    expect(bookingContacts('011 234 5678', '077 765 4321')).toEqual({
      callHref: 'tel:+94112345678',
      whatsappHref: 'https://wa.me/94777654321',
    });
  });

  it('does not offer WhatsApp for a landline or turn invalid text into a contact link', () => {
    expect(bookingContacts('0112345678')).toEqual({ callHref: 'tel:+94112345678', whatsappHref: null });
    expect(bookingContacts('not a phone')).toEqual({ callHref: null, whatsappHref: null });
    expect(bookingContacts(row.phone, 'invalid').whatsappHref).toBe('https://wa.me/94771234567');
  });

  it('offers only allowed forward actions, with none for final statuses', () => {
    const statuses: BookingStatus[] = ['new', 'contacted', 'visited', 'purchased', 'lost', 'cancelled'];
    for (const status of statuses) {
      const action = primaryStatusAction(status);
      if (action) expect(allowedTransitions(status)).toContain(action.value);
      else expect(allowedTransitions(status)).toHaveLength(0);
    }
    expect(primaryStatusAction('contacted')).toEqual({ value: 'visited', label: 'Mark as visited' });
    expect(primaryStatusAction('visited')).toEqual({ value: 'purchased', label: 'Mark as purchased' });
  });
});

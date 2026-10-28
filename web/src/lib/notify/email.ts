import 'server-only';

import { format, parseISO } from 'date-fns';
import { env, hasEmail, siteUrl } from '@/lib/env';
import { formatLkPhone } from '@/lib/phone';

// Owner alerts by email through Resend. Optional: it does nothing unless
// RESEND_API_KEY and ADMIN_ALERT_EMAIL are both set, and it never throws, so a
// mail problem can never fail or slow down the booking that triggered it.

export type OwnerBookingEmail = {
  reference: string;
  bookingId?: number;
  customerName: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  preferredContact?: 'whatsapp' | 'call' | 'email';
  notes?: string | null;
  /** YYYY-MM-DD */
  visitDate: string;
  slotLabel: string;
  items: Array<{ name: string; colourName: string | null; quantity: number }>;
};

const CONTACT_LABEL = { whatsapp: 'WhatsApp', call: 'Phone call', email: 'Email' } as const;

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

function visitDay(date: string): string {
  try {
    return format(parseISO(date), 'EEE d MMM yyyy');
  } catch {
    return date;
  }
}

/** Subject, HTML and plain-text bodies for the "new booking" alert. Every visitor-supplied value is escaped. */
export function buildOwnerBookingEmail(summary: OwnerBookingEmail): { subject: string; html: string; text: string } {
  const when = [visitDay(summary.visitDate), summary.slotLabel].filter(Boolean).join(', ');
  const pieces = summary.items.length
    ? summary.items.map((item) => `${item.quantity} x ${item.name}${item.colourName ? ` (${item.colourName})` : ''}`)
    : ['No pieces selected'];
  const rows: Array<[string, string]> = [
    ['Reference', summary.reference],
    ['Visit', when],
    ['Name', summary.customerName],
    ['Phone', formatLkPhone(summary.phone)],
  ];
  if (summary.email) rows.push(['Email', summary.email]);
  if (summary.city) rows.push(['City', summary.city]);
  rows.push(['Preferred contact', CONTACT_LABEL[summary.preferredContact ?? 'whatsapp']]);
  rows.push(['Pieces', pieces.join('\n')]);
  if (summary.notes) rows.push(['Notes', summary.notes]);

  const adminUrl = summary.bookingId ? `${siteUrl()}/admin/bookings/${summary.bookingId}/` : null;
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#141211;max-width:560px">',
    '<h1 style="font-size:20px;margin:0 0 4px">New showroom booking</h1>',
    `<p style="margin:0 0 16px;color:#6f6862">${escapeHtml(summary.reference)}</p>`,
    '<table style="border-collapse:collapse;width:100%">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6f6862;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;vertical-align:top">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`,
    ),
    '</table>',
    adminUrl ? `<p style="margin:20px 0 0"><a href="${escapeHtml(adminUrl)}" style="color:#842323">Open this booking in the admin</a></p>` : '',
    '</div>',
  ].join('');
  const text = [...rows.map(([label, value]) => `${label}: ${value.replace(/\n/g, '; ')}`), adminUrl ? `Admin: ${adminUrl}` : ''].filter(Boolean).join('\n');

  return { subject: oneLine(`New booking ${summary.reference}: ${when}`), html, text };
}

/** Tells the owner about a new booking. No-op without Resend configuration; logs and returns on any failure. */
export async function sendOwnerBookingEmail(summary: OwnerBookingEmail): Promise<void> {
  if (!hasEmail()) return;
  try {
    const apiKey = env.RESEND_API_KEY;
    const recipients = (env.ADMIN_ALERT_EMAIL ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
    if (!apiKey || recipients.length === 0) return;

    const { Resend } = await import('resend');
    const { subject, html, text } = buildOwnerBookingEmail(summary);
    const { error } = await new Resend(apiKey).emails.send({
      from: env.EMAIL_FROM,
      to: recipients,
      subject,
      html,
      text,
      // Replying to the alert reaches the visitor, when they gave an email address.
      replyTo: summary.email || undefined,
    });
    if (error) console.error(`[email] Resend refused the booking alert for ${summary.reference}:`, error.message);
  } catch (error) {
    console.error(`[email] could not send the booking alert for ${summary.reference}:`, error);
  }
}

import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { env, hasEmail, siteUrl } from '@/lib/env';
import { notify } from '@/lib/notify/bell';
import { colomboDate, colomboDayEnd, colomboDayStart } from './rollup';

// The morning digest: yesterday's visitors and the bookings taken yesterday.
// Sending mail is best-effort, so a missing or failing Resend key never breaks
// the cron route.

export type DigestBooking = { reference: string; name: string; slotLabel: string };

export type DigestSummary = {
  date: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  bookings: number;
  bookingRows: DigestBooking[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildDigest(now: Date = new Date()): Promise<DigestSummary> {
  const db = await getDb();
  const date = colomboDate(new Date(now.getTime() - DAY_MS));
  const from = colomboDayStart(date);
  const to = colomboDayEnd(date);

  const [traffic, bookingCount, bookingRows] = await Promise.all([
    db
      .select({
        visitors: sql<number>`count(distinct ${s.events.visitorId})::int`,
        sessions: sql<number>`count(distinct ${s.events.sessionId})::int`,
        pageViews: sql<number>`(count(*) filter (where ${s.events.type} = 'page_view'))::int`,
      })
      .from(s.events)
      .where(and(gte(s.events.createdAt, from), lt(s.events.createdAt, to))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.bookings)
      .where(and(gte(s.bookings.createdAt, from), lt(s.bookings.createdAt, to))),
    db
      .select({ reference: s.bookings.reference, name: s.customers.name, slotLabel: s.bookings.slotLabel })
      .from(s.bookings)
      .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
      .where(and(gte(s.bookings.createdAt, from), lt(s.bookings.createdAt, to)))
      .orderBy(desc(s.bookings.createdAt))
      .limit(10),
  ]);

  const counts = traffic[0];
  return {
    date,
    visitors: counts?.visitors ?? 0,
    sessions: counts?.sessions ?? 0,
    pageViews: counts?.pageViews ?? 0,
    bookings: bookingCount[0]?.count ?? 0,
    bookingRows,
  };
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);

export function digestSubject(summary: DigestSummary): string {
  const date = new Date(`${summary.date}T00:00:00Z`);
  const label = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
  return `Yesterday (${label}): ${summary.visitors} visitors, ${summary.bookings} bookings`;
}

export function digestHtml(summary: DigestSummary): string {
  const rows = summary.bookingRows.length
    ? `<ul>${summary.bookingRows
        .map((booking) => {
          const reference = escapeHtml(booking.reference);
          const name = escapeHtml(booking.name);
          const slot = escapeHtml(booking.slotLabel);
          return `<li><strong>${reference}</strong> — ${name} · ${slot}</li>`;
        })
        .join('')}</ul>`
    : '<p>No bookings were taken yesterday.</p>';
  const visitorsLine =
    `<p>Visitors yesterday: <strong>${summary.visitors}</strong> ` +
    `(${summary.sessions} sessions, ${summary.pageViews} page views).</p>`;
  return [
    visitorsLine,
    `<p>Bookings taken: <strong>${summary.bookings}</strong>.</p>`,
    rows,
    '<p><a href="' + siteUrl() + '/admin/visitors/">Open the Visitors page</a></p>',
  ].join('\n');
}

/** Resend email when the keys exist. Always resolves; failures are logged. */
export async function sendDigestEmail(summary: DigestSummary): Promise<boolean> {
  if (!hasEmail() || !env.RESEND_API_KEY || !env.ADMIN_ALERT_EMAIL) return false;
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: env.ADMIN_ALERT_EMAIL,
      subject: digestSubject(summary),
      html: digestHtml(summary),
    });
    if (error) {
      console.error('[digest] Resend refused the email:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[digest] could not send email:', error);
    return false;
  }
}

export type DigestResult = { ok: boolean; summary: DigestSummary | null; emailed: boolean };

/** Cron entry point: build the numbers, send the mail if configured, ring the bell. Never throws. */
export async function runDigest(now: Date = new Date()): Promise<DigestResult> {
  try {
    const summary = await buildDigest(now);
    const emailed = await sendDigestEmail(summary);
    const body =
      `${summary.visitors} visitors, ${summary.sessions} sessions and ` +
      `${summary.pageViews} page views. ${summary.bookings} bookings taken.`;
    await notify({
      type: 'digest',
      title: digestSubject(summary),
      body,
      link: '/admin/visitors/',
    });
    return { ok: true, summary, emailed };
  } catch (error) {
    console.error('[digest] could not build the digest:', error);
    return { ok: false, summary: null, emailed: false };
  }
}

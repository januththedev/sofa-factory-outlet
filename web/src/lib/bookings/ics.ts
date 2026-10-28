import type { BusinessSettings } from '@/lib/settings/types';
import type { BookingSummary } from './api';

const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function foldLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75 && current) { result.push(current); current = ' '; bytes = 1; }
    current += character; bytes += size;
  }
  result.push(current);
  return result;
}
const localDateTime = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
export function buildIcs(summary: BookingSummary, business: BusinessSettings): string {
  const [start = '10:00', end = '12:00'] = summary.slotLabel.split(/[\u2013-]/).map((value) => value.trim());
  const address = [business.address.street, business.address.locality, business.address.city, 'Sri Lanka'].filter(Boolean).join(', ');
  const pieces = summary.items.length ? summary.items.map((item) => `${item.quantity}× ${item.name}${item.colourName ? ` (${item.colourName})` : ''}`).join(', ') : 'No pieces selected';
  const created = summary.createdAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sofa Factory Outlet//Showroom Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${escapeText(summary.reference)}@sofafactoryoutlet.lk`, `DTSTAMP:${created}`,
    `DTSTART;TZID=Asia/Colombo:${localDateTime(summary.visitDate, start)}`, `DTEND;TZID=Asia/Colombo:${localDateTime(summary.visitDate, end)}`,
    'SUMMARY:Showroom visit: Sofa Factory Outlet', `LOCATION:${escapeText(address)}`,
    `DESCRIPTION:${escapeText(`Booking ${summary.reference}\nChosen pieces: ${pieces}`)}`, 'END:VEVENT', 'END:VCALENDAR'];
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`;
}

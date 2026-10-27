import type { DayKey, HoursSettings } from './types';

const ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const NAMES: Record<DayKey, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

function clock(value: string): string {
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

/** "Mon–Sat 10 am–6 pm", grouping consecutive days that share the same hours; "Sun closed". */
export function formatHours(hours: HoursSettings): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < ORDER.length) {
    const first = ORDER[i];
    const spec = hours.days[first];
    let j = i;
    while (j + 1 < ORDER.length && JSON.stringify(hours.days[ORDER[j + 1]]) === JSON.stringify(spec)) j += 1;
    const label = i === j ? NAMES[first] : `${NAMES[first]}–${NAMES[ORDER[j]]}`;
    lines.push(spec ? `${label} ${clock(spec.open)}–${clock(spec.close)}` : `${label} closed`);
    i = j + 1;
  }
  return lines;
}

export const DAY_KEYS = ORDER;
export const weekdayToKey = (weekday: number): DayKey => ORDER[(weekday + 6) % 7];

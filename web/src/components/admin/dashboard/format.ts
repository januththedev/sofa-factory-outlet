/** "Wed 29 Oct" for a YYYY-MM-DD calendar date (the date itself, so no time zone shift). */
export const formatDay = (date: string): string =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );

/** "29 Oct" */
export const formatShortDay = (date: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );

/** "Wednesday 29 October 2026" in Sri Lanka time, for the page header. */
export const formatToday = (now: Date): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'Asia/Colombo' }).format(now);

export const formatCount = (value: number): string => value.toLocaleString('en-LK');

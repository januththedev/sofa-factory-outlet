const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "27 October 2026 · 7 min read" for a guide. */
export function GuideMeta({ datePublished, readingMinutes }: { datePublished: string; readingMinutes: number }) {
  return (
    <p className="text-sm text-mute">
      <time dateTime={datePublished}>{DATE_FORMAT.format(new Date(`${datePublished}T00:00:00Z`))}</time>
      <span aria-hidden> · </span>
      <span>{readingMinutes} min read</span>
    </p>
  );
}

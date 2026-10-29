import { notFound } from 'next/navigation';

// Any URL with no page of its own lands here so it gets the site's header, footer and a real 404 status.
export default function Unmatched(): never {
  notFound();
}

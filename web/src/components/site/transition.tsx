import Link from 'next/link';

/**
 * Site links. There is no page-transition overlay: a click navigates straight away and the next
 * page (or its loading skeleton) shows as soon as it is ready. Kept as a wrapper so every
 * internal link in the site goes through one place.
 */
export function TransitionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

type TLinkProps = Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string };

export function TLink({ href, ...props }: TLinkProps) {
  return <Link href={href} {...props} />;
}

// The Content-Security-Policy sent with every response (see next.config.ts).
//
// A nonce would make every page render on each request (no static pages, no CDN cache), which this
// catalogue site cannot afford, so scripts keep 'unsafe-inline' for Next's own bootstrap scripts and the
// preloader boot script in the root layout. Everything else is closed down to this site plus the few
// services the pages really use:
//   Cloudflare Turnstile  script, frame and connect (the booking and chat forms)
//   Google Maps           frames only (the showroom map embeds)
//   Vercel Blob           images, once photos are served from the store instead of /blob/
// OpenRouter, Resend, Search Console and IndexNow are called from the server and need no entry.

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
export const MAP_ORIGINS = ['https://www.google.com', 'https://maps.google.com'];
export const BLOB_IMAGE_ORIGIN = 'https://*.public.blob.vercel-storage.com';

type Options = {
  /** Add upgrade-insecure-requests: only for an https site (it is pointless on http://localhost). */
  upgradeInsecure: boolean;
};

export function buildContentSecurityPolicy({ upgradeInsecure }: Options): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${TURNSTILE_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${BLOB_IMAGE_ORIGIN}`,
    "font-src 'self' data:",
    `connect-src 'self' ${TURNSTILE_ORIGIN}`,
    `frame-src 'self' ${TURNSTILE_ORIGIN} ${MAP_ORIGINS.join(' ')}`,
    "worker-src 'self' blob:",
    "media-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];
  if (upgradeInsecure) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

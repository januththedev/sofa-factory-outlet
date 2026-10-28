import { handlers } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

// Auth.js reads the action from the URL path and ignores a trailing slash, so
// `trailingSlash: true` (which makes /api/auth/session/ the canonical URL) works
// unchanged. The sign-in form itself is a server action; these endpoints stay for
// Auth.js's own redirects and are rate-limited like the action (see credentials.ts).
export const { GET, POST } = handlers;

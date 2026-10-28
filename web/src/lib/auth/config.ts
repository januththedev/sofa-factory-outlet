import 'server-only';
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { env, siteUrl } from '@/lib/env';
import { authorizeCredentials } from './credentials';
import { LOGIN_PATH } from './paths';

/** Admin sessions last 12 hours from sign-in, then the person signs in again. */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

const MIN_SECRET_LENGTH = 32;
// Development and tests only: never used when NODE_ENV is "production".
const DEV_SECRET = 'sofa-factory-outlet-local-development-secret-do-not-deploy';

/**
 * The secret that signs and encrypts session cookies. In production a missing,
 * short or still-placeholder `AUTH_SECRET` yields '' on purpose: Auth.js then
 * refuses every request ("MissingSecret") and sign-in stays closed, instead of
 * running on a guessable key. (An empty string, not undefined, so next-auth does
 * not fall back to reading the raw environment variable itself.)
 */
export function resolveAuthSecret(input: { secret?: string; nodeEnv: string }): string {
  const secret = input.secret?.trim() ?? '';
  if (input.nodeEnv === 'production') {
    return secret.length >= MIN_SECRET_LENGTH && !/^replace/i.test(secret) ? secret : '';
  }
  return secret || DEV_SECRET;
}

export const authSecret = resolveAuthSecret({ secret: env.AUTH_SECRET, nodeEnv: env.NODE_ENV });

/** Auth.js error type ("CredentialsSignin", "CallbackRouteError", ...) or null when the value is not an Auth.js error. */
export function authErrorType(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const type = (error as { type?: unknown }).type;
  return typeof type === 'string' ? type : null;
}

export const authConfig: NextAuthConfig = {
  basePath: '/api/auth',
  secret: authSecret,
  trustHost: true,
  // Secure (`__Secure-`) cookies whenever the site is served over https. The
  // cookie stays HttpOnly and SameSite=Lax (Auth.js defaults), so scripts cannot
  // read it and other sites cannot send it with a POST.
  useSecureCookies: Boolean(process.env.VERCEL) || siteUrl().startsWith('https://'),
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: LOGIN_PATH, signOut: LOGIN_PATH, error: LOGIN_PATH },
  providers: [
    Credentials({
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
      authorize: (credentials, request) => authorizeCredentials(credentials, request),
    }),
  ],
  callbacks: {
    // The cookie only needs to say who signed in; getSession() reads name, email
    // and role fresh from the database on every request.
    session: ({ session, token }) => ({ ...session, user: { ...session.user, id: token.sub ?? '' } }),
  },
  // Quiet and secret-safe: no debug output (it would include the submitted form),
  // no stack traces, and failed passwords are not worth a log line each.
  logger: {
    error(error) {
      if (authErrorType(error) === 'CredentialsSignin') return;
      const cause = (error as { cause?: { err?: unknown } }).cause?.err;
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : error.message;
      console.error(`[auth] ${authErrorType(error) ?? error.name}: ${detail.slice(0, 300)}`);
    },
    warn: (code) => console.warn(`[auth] warning: ${code}`),
    debug: () => {},
  },
};

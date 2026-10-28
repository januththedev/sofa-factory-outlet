'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn, signOut } from './auth';
import { authErrorType, authSecret } from './config';
import { credentialsSchema } from './credentials';
import { ADMIN_HOME, LOGIN_PATH, sanitiseNext, SESSION_COOKIE_NAMES } from './paths';
import { clientIp, loginLimiter } from './rate-limit';

export type SignInState = { error?: string } | undefined;

// One message for "no such email", "wrong password" and "account switched off":
// nothing here may reveal which emails exist.
const WRONG_CREDENTIALS = 'Email or password is wrong';
const INVALID_INPUT = 'Enter your email address and your password.';
const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';
const UNAVAILABLE = 'Sign-in is not available right now. Please try again in a moment.';

/**
 * Form action for /admin/login/. Checks the input with Zod, refuses early when the
 * email+address pair is rate-limited, then lets Auth.js verify the password (see
 * authorizeCredentials, which also counts the failures) and set the session
 * cookie. Redirects to the validated `next` page, or /admin/.
 */
export async function signInAction(previous: SignInState, formData: FormData): Promise<SignInState> {
  void previous;
  const parsed = credentialsSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: INVALID_INPUT };
  const { email, password } = parsed.data;
  // The hidden field is user-controlled: only same-origin /admin/... paths survive.
  const next = sanitiseNext(formData.get('next'));
  const ip = clientIp(await headers());

  if (loginLimiter.isBlocked(email, ip)) return { error: TOO_MANY };
  if (!authSecret) {
    console.error('[auth] Sign-in is closed: AUTH_SECRET is missing, shorter than 32 characters or still the placeholder.');
    return { error: UNAVAILABLE };
  }

  let destination: unknown;
  try {
    destination = await signIn('credentials', { email, password, redirect: false, redirectTo: ADMIN_HOME });
  } catch (error) {
    const type = authErrorType(error);
    if (type === 'CredentialsSignin') return { error: loginLimiter.isBlocked(email, ip) ? TOO_MANY : WRONG_CREDENTIALS };
    if (!type) throw error;
    console.error(`[auth] Sign-in failed with ${type}.`);
    return { error: UNAVAILABLE };
  }
  // A configuration fault can come back as a plain response instead of an error;
  // then no cookie was set and the "success" URL still points at the auth API.
  if (typeof destination !== 'string' || destination.includes('/api/auth/')) {
    console.error('[auth] Sign-in did not create a session.');
    return { error: UNAVAILABLE };
  }
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  try {
    await signOut({ redirect: false, redirectTo: LOGIN_PATH });
  } catch (error) {
    if (!authErrorType(error)) throw error;
    console.error('[auth] Sign-out reported an error; clearing the cookie directly.');
  }
  // Belt and braces: expire the cookie ourselves, with the attributes it was set with.
  const jar = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    if (jar.has(name)) {
      jar.set(name, '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax', secure: name.startsWith('__Secure-') });
    }
  }
  redirect(LOGIN_PATH);
}

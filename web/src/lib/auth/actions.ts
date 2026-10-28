'use server';

import { notImplemented } from '../not-implemented';

// CONTRACT STUB. Owner: "auth-shell" agent. Keep these exports and signatures.

export type SignInState = { error?: string } | undefined;

/** Form action for /admin/login/: validates with Zod, checks bcrypt, rate-limits, then redirects to /admin/. */
export async function signInAction(previous: SignInState, formData: FormData): Promise<SignInState> {
  void previous;
  void formData;
  return notImplemented('signInAction');
}

export async function signOutAction(): Promise<void> {
  return notImplemented('signOutAction');
}

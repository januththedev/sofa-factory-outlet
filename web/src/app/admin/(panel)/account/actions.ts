'use server';

import { changeOwnPassword, passwordProblem } from '@/lib/auth/change-password';
import { createFailureLimiter, FAILURE_WINDOW_MS } from '@/lib/auth/rate-limit';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

export type PasswordFormState = { ok: boolean; message: string; at: number } | null;

// Wrong "current password" guesses: five per fifteen minutes per account, so a borrowed session
// cannot be used to guess the real password.
const limiter = createFailureLimiter({ max: 5, windowMs: FAILURE_WINDOW_MS });

export async function changePasswordAction(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const session = await requireRole('any');
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const fail = (message: string): PasswordFormState => ({ ok: false, message, at: Date.now() });

  if (!current || !next) return fail('Fill in every box.');
  if (next !== confirm) return fail('The two new passwords do not match.');
  const problem = passwordProblem(next, current);
  if (problem) return fail(problem);
  const key = `pw:${session.userId}`;
  if (limiter.isBlocked(key)) return fail('Too many wrong attempts. Wait a few minutes and try again.');

  const result = await changeOwnPassword(await getDb(), session.userId, current, next);
  if (!result.ok) {
    limiter.recordFailure(key);
    return fail(result.error);
  }
  limiter.reset(key);
  return { ok: true, message: 'Password changed. Use the new one next time you sign in.', at: Date.now() };
}

'use client';

import { useActionState } from 'react';
import { changePasswordAction, type PasswordFormState } from '@/app/admin/(panel)/account/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/change-password';

const LABEL = 'mb-1.5 block text-base font-medium text-ink-2 sm:text-sm';

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(changePasswordAction, null);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <div>
        <label htmlFor="pw-current" className={LABEL}>Current password</label>
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <label htmlFor="pw-next" className={LABEL}>New password</label>
        <Input
          id="pw-next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <p className="mt-1 text-sm text-mute">At least {MIN_PASSWORD_LENGTH} characters. A few random words work well.</p>
      </div>
      <div>
        <label htmlFor="pw-confirm" className={LABEL}>New password again</label>
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? 'Changing…' : 'Change password'}</Button>
        <p
          role="status"
          aria-live="polite"
          className={`text-base sm:text-sm ${state && !state.ok ? 'text-bad' : 'text-good'}`}
        >
          {state?.message ?? ''}
        </p>
      </div>
    </form>
  );
}

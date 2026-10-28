'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { signInAction, type SignInState } from '@/lib/auth/actions';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, undefined);
  // Controlled, so a failed attempt keeps the email while React clears the password.
  const [email, setEmail] = useState('');
  const error = state?.error;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="login-email">
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="login-error"
        />
      </Field>
      <Field label="Password" htmlFor="login-password">
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby="login-error"
        />
      </Field>
      {/* Always in the page, so assistive technology announces the message when it appears. */}
      <div id="login-error" aria-live="polite" className="min-h-5 text-sm text-bad">
        {error ?? ''}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

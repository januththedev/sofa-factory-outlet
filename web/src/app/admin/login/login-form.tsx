'use client';

import { useActionState } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/field';
import { signInAction } from '@/lib/auth/actions';
import { type SignInState } from '@/lib/auth/actions';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, undefined);
  // Keep the typed details when a sign-in attempt fails.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const error = state?.error;
  useEffect(() => {
    if (state?.error) document.getElementById('login-email')?.focus();
  }, [state]);

  return (
    <form
      action={formAction}
      className="space-y-5"
      onBlur={(event) => {
        if (event.target instanceof HTMLInputElement) event.target.reportValidity();
      }}
    >
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="login-email">
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          enterKeyHint="next"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="login-error"
        />
      </Field>
      <Field label="Password" htmlFor="login-password">
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            inputMode="text"
            enterKeyHint="go"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby="login-error"
            className="pr-20"
          />
          <Button
            variant="subtle"
            className="absolute right-1 top-1/2 min-w-16 -translate-y-1/2 px-2"
            aria-controls="login-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((previous) => !previous)}
          >
            {showPassword ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </Button>
        </div>
      </Field>
      {/* Always in the page, so assistive technology announces the message when it appears. */}
      <div id="login-error" aria-live="polite" className="min-h-32 text-base sm:text-sm text-bad">
        {error ? (
          <>
            <p>{error}</p>
            <a href="#login-email" className="inline-flex min-h-11 items-center underline">Check sign-in details</a>
          </>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

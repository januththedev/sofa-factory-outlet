'use client';

import { useEffect, useRef, useState } from 'react';
import { useNearViewport } from '@/lib/motion/hooks';
import { TURNSTILE_FIELD } from './schema';

// Cloudflare Turnstile, loaded only when the form scrolls near so visitors who
// never reach the end of the form download nothing. It renders explicitly,
// reports the token to the form, and shows a retry instead of hanging when the
// script cannot be loaded. Only the public site key is used here.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOAD_TIMEOUT_MS = 15_000;

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

const turnstileApi = (): TurnstileApi | undefined => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

let pendingLoad: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  const ready = turnstileApi();
  if (ready) return Promise.resolve(ready);
  pendingLoad ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = (reason: string) => {
      window.clearTimeout(timer);
      script.remove();
      pendingLoad = null;
      reject(new Error(reason));
    };
    const timer = window.setTimeout(() => fail('Turnstile took too long to load'), LOAD_TIMEOUT_MS);
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.clearTimeout(timer);
      const api = turnstileApi();
      if (api) resolve(api);
      else fail('Turnstile loaded but is not available');
    };
    script.onerror = () => fail('Turnstile could not be loaded');
    document.head.appendChild(script);
  });
  return pendingLoad;
}

type TurnstileWidgetProps = {
  siteKey: string;
  /** The current token, exposed in a hidden field. Empty until the check passes. */
  token: string;
  onToken: (token: string) => void;
  /** Changes whenever a submission has used up the token; the widget then asks for a new one. */
  resetKey?: unknown;
  describedBy?: string;
};

export function TurnstileWidget({ siteKey, token, onToken, resetKey, describedBy }: TurnstileWidgetProps) {
  const [nearRef, near] = useNearViewport<HTMLDivElement>('400px');
  const mount = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = mount.current;
    if (!near || !container) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetId.current = api.render(container, {
          sitekey: siteKey,
          size: 'flexible',
          callback: (value: string) => onToken(value),
          'expired-callback': () => onToken(''),
          'timeout-callback': () => { onToken(''); setFailed(true); },
          'error-callback': () => { onToken(''); setFailed(true); },
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      const id = widgetId.current;
      widgetId.current = null;
      if (id) turnstileApi()?.remove(id);
    };
  }, [near, siteKey, attempt, onToken]);

  useEffect(() => {
    if (widgetId.current) turnstileApi()?.reset(widgetId.current);
  }, [resetKey]);

  const retry = () => {
    setFailed(false);
    setReady(false);
    setAttempt((value) => value + 1);
  };

  return (
    <div ref={nearRef} role="group" aria-label="Quick check" aria-describedby={describedBy} className="min-h-[65px]">
      <input type="hidden" name={TURNSTILE_FIELD} value={token} readOnly />
      <div ref={mount} />
      <div aria-live="polite">
        {failed ? (
          <p className="text-sm text-bad">
            We could not load the quick check. Please check your connection and{' '}
            <button type="button" onClick={retry} className="font-semibold text-maroon underline underline-offset-4">
              try again
            </button>
            .
          </p>
        ) : near && !ready ? (
          <p className="text-sm text-mute">Loading the quick check…</p>
        ) : null}
      </div>
    </div>
  );
}

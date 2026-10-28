/** Field limits for the on-site review form, shared by the form and the server-side check. */
export const REVIEW_LIMITS = {
  titleMax: 120,
  bodyMin: 10,
  bodyMax: 2000,
  nameMin: 2,
  nameMax: 80,
} as const;

/** What the form shows after a send attempt. */
export type ReviewFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors: Partial<Record<'rating' | 'title' | 'body' | 'name', string>> }
  | { status: 'done' };

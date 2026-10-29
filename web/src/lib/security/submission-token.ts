/** Browser-generated identity survives refresh/retry within a tab; no customer details are stored. */
export function submissionToken(kind: 'booking' | 'quote'): string {
  const key = `sfo-submission-${kind}`;
  try {
    const prior = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      typeof prior?.token === 'string' &&
      /^[a-f0-9]{64}$/.test(prior.token) &&
      prior.expires > Date.now()
    )
      return prior.token;
  } catch {
    /* Storage may be disabled. The component still retains the token in memory. */
  }
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ token, expires: Date.now() + 3600000 }),
    );
  } catch {}
  return token;
}
export function clearSubmissionToken(kind: 'booking' | 'quote'): void {
  try {
    sessionStorage.removeItem(`sfo-submission-${kind}`);
  } catch {}
}

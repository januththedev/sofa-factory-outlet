/**
 * Sri Lankan phone numbers. Accepts 0771234567, 077 123 4567, +94 77 123 4567,
 * 0094771234567, 94771234567 and landlines such as 011 234 5678; returns E.164
 * (+94771234567) or null. Customers are matched by this normalised number.
 */
export function normaliseLkPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0094')) digits = digits.slice(4);
  else if (digits.startsWith('94') && digits.length === 11) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return /^[1-9]\d{8}$/.test(digits) ? `+94${digits}` : null;
}

/** Mobile numbers (07x) can have WhatsApp; landlines cannot. */
export const isLkMobile = (e164: string) => /^\+947\d{8}$/.test(e164);

/** "+94771234567" → "+94 77 123 4567" (landlines: "+94 11 234 5678"). */
export function formatLkPhone(e164: string): string {
  const m = e164.match(/^\+94(\d{2})(\d{3})(\d{4})$/);
  return m ? `+94 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Digits only, for wa.me links ("94771234567"). */
export const whatsappDigitsFor = (e164: string) => e164.replace(/\D/g, '');

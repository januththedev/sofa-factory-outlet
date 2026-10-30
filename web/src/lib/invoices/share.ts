import { jwtVerify, SignJWT } from 'jose';

// Share links get their own audience so a review link (which also carries an invoiceId) cannot open the PDF.
const AUDIENCE = 'sofa-factory-outlet:invoice-pdf';

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET || process.env.CRON_SECRET;
  if (!value) throw new Error('Invoice share links require AUTH_SECRET or CRON_SECRET');
  return new TextEncoder().encode(value);
}

export async function createShareLink(invoiceId: number): Promise<string> {
  const token = await new SignJWT({ invoiceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
  return `/api/invoices/${invoiceId}/pdf/?t=${token}`;
}

export async function verifyShareToken(invoiceId: number, token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    // Links issued before the audience existed carry none; anything with another audience is refused.
    if (payload.aud !== undefined && payload.aud !== AUDIENCE) return false;
    return payload.invoiceId === invoiceId;
  } catch {
    return false;
  }
}

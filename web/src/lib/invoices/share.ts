import { jwtVerify, SignJWT } from 'jose';

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET || process.env.CRON_SECRET;
  if (!value) throw new Error('Invoice share links require AUTH_SECRET or CRON_SECRET');
  return new TextEncoder().encode(value);
}

export async function createShareLink(invoiceId: number): Promise<string> {
  const token = await new SignJWT({ invoiceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
  return `/api/invoices/${invoiceId}/pdf/?t=${token}`;
}

export async function verifyShareToken(invoiceId: number, token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return payload.invoiceId === invoiceId;
  } catch {
    return false;
  }
}

import { requireRole } from '@/lib/auth/session';
import { getInvoice, renderInvoicePdf, verifyShareToken } from '@/lib/invoices/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const invoiceId = Number(rawId);
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) return new Response('Not found', { status: 404 });
  const token = new URL(request.url).searchParams.get('t');
  if (!token || !(await verifyShareToken(invoiceId, token))) await requireRole('any');
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.status === 'draft') return new Response('Not found', { status: 404 });
  const buffer = await renderInvoicePdf(invoiceId);
  const filename = (invoice.number ?? `invoice-${invoice.id}`).replace(/[^A-Za-z0-9._-]/g, '_');
  return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}.pdf"` } });
}

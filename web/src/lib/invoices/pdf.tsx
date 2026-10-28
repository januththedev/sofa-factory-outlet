import fs from 'node:fs/promises';
import path from 'node:path';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { formatLkr } from '@/lib/money';
import { getSettings } from '@/lib/settings/get';
import type { InvoiceView } from './api';
import { getInvoice } from './service';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 36, color: '#211b18' },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  logo: { width: 120, height: 48, objectFit: 'contain', objectPosition: 'left' },
  title: { fontSize: 20, marginBottom: 4 },
  muted: { color: '#655c57', lineHeight: 1.4 },
  section: { marginTop: 20 },
  heading: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#eee8e1', padding: 6, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', padding: 6, borderBottomWidth: 0.5, borderBottomColor: '#ddd3ca' },
  description: { width: '31%' }, colour: { width: '14%' }, qty: { width: '8%', textAlign: 'right' },
  money: { width: '15.5%', textAlign: 'right' },
  totals: { width: 240, marginLeft: 'auto', marginTop: 14 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grandTotal: { borderTopWidth: 1, paddingTop: 6, marginTop: 3, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 45 },
  signature: { width: '42%', borderTopWidth: 0.75, paddingTop: 5, textAlign: 'center' },
});

type Settings = Awaited<ReturnType<typeof getSettings>>;

function InvoiceDocument({ invoice, settings, logo }: { invoice: InvoiceView; settings: Settings; logo: string }) {
  const bank = settings.invoice.bank;
  const bankLines = [bank.bank, bank.branch, bank.accountName, bank.accountNumber].filter(Boolean);
  const address = settings.business.address;
  return (
    <Document title={invoice.number ?? 'Invoice'}>
      <Page size="A4" style={styles.page}>
        <View style={styles.between}>
          <Image src={logo} style={styles.logo} />
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.title}>{invoice.type === 'quotation' ? 'QUOTATION' : 'INVOICE'}</Text>
            <Text>{invoice.number}</Text>
            {invoice.issuedAt ? <Text style={styles.muted}>{invoice.issuedAt.slice(0, 10)}</Text> : null}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>{settings.business.name}</Text>
          <Text style={styles.muted}>{[address.street, address.locality, address.city].filter(Boolean).join(', ')}</Text>
          {settings.business.whatsapp.number ? <Text style={styles.muted}>WhatsApp: {settings.business.whatsapp.number}</Text> : null}
        </View>
        <View style={[styles.section, styles.between]}>
          <View style={{ width: '55%' }}><Text style={styles.heading}>Customer</Text><Text>{invoice.customer.name}</Text><Text style={styles.muted}>{invoice.customer.phone}</Text>{invoice.customer.address ? <Text style={styles.muted}>{invoice.customer.address}</Text> : null}</View>
          {bankLines.length ? <View style={{ width: '38%' }}><Text style={styles.heading}>Bank details</Text>{bankLines.map((line) => <Text key={line} style={styles.muted}>{line}</Text>)}</View> : null}
        </View>
        <View style={styles.section}>
          <View style={styles.tableHeader}><Text style={styles.description}>Description</Text><Text style={styles.colour}>Colour</Text><Text style={styles.qty}>Qty</Text><Text style={styles.money}>Unit</Text><Text style={styles.money}>Discount</Text><Text style={styles.money}>Total</Text></View>
          {invoice.lines.map((line) => <View key={line.id} style={styles.tableRow}><Text style={styles.description}>{line.description}</Text><Text style={styles.colour}>{line.colourName ?? '—'}</Text><Text style={styles.qty}>{line.quantity}</Text><Text style={styles.money}>{formatLkr(line.unitMinor, { decimals: true })}</Text><Text style={styles.money}>{formatLkr(line.discountMinor ?? 0, { decimals: true })}</Text><Text style={styles.money}>{formatLkr(line.lineMinor, { decimals: true })}</Text></View>)}
        </View>
        <View style={styles.totals}>
          <View style={styles.totalLine}><Text>Subtotal</Text><Text>{formatLkr(invoice.subtotalMinor, { decimals: true })}</Text></View>
          {invoice.discountMinor ? <View style={styles.totalLine}><Text>Discount</Text><Text>− {formatLkr(invoice.discountMinor, { decimals: true })}</Text></View> : null}
          {invoice.deliveryMinor ? <View style={styles.totalLine}><Text>Delivery</Text><Text>{formatLkr(invoice.deliveryMinor, { decimals: true })}</Text></View> : null}
          {invoice.taxMinor ? <View style={styles.totalLine}><Text>{settings.invoice.taxLabel}</Text><Text>{formatLkr(invoice.taxMinor, { decimals: true })}</Text></View> : null}
          <View style={[styles.totalLine, styles.grandTotal]}><Text>Total</Text><Text>{formatLkr(invoice.totalMinor, { decimals: true })}</Text></View>
          <View style={styles.totalLine}><Text>Paid</Text><Text>{formatLkr(invoice.paidMinor, { decimals: true })}</Text></View>
          <View style={styles.totalLine}><Text>Balance</Text><Text>{formatLkr(invoice.balanceMinor, { decimals: true })}</Text></View>
        </View>
        {invoice.deliveryDate ? <Text style={styles.section}>Delivery date: {invoice.deliveryDate}</Text> : null}
        <View style={styles.section}><Text style={styles.heading}>Warranty</Text><Text style={styles.muted}>{settings.invoice.warranty}</Text></View>
        <View style={styles.section}><Text style={styles.heading}>Terms</Text><Text style={styles.muted}>{invoice.terms || settings.invoice.terms}</Text></View>
        <View style={styles.signatures}><Text style={styles.signature}>Authorised signature</Text><Text style={styles.signature}>Customer signature</Text></View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoiceId: number): Promise<Buffer> {
  const [invoice, settings, logo] = await Promise.all([
    getInvoice(invoiceId), getSettings(), fs.readFile(path.join(process.cwd(), 'public', 'brand', 'logo.png')),
  ]);
  if (!invoice || invoice.status === 'draft') throw new Error('Invoice not found');
  const dataUri = `data:image/png;base64,${logo.toString('base64')}`;
  return renderToBuffer(<InvoiceDocument invoice={invoice} settings={settings} logo={dataUri} />);
}

'use client';

import { Modal } from '@/components/admin/knowledge/modal';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordPaymentAction } from '@/app/admin/(panel)/invoices/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/field';
import { Select } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import { minorToRupeesInput } from '@/lib/admin/invoices';
import { rupeesToMinor } from '@/lib/admin/invoices';
import { formatLkr } from '@/lib/money';

const methods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
] as const;

export function PaymentDialog({
  invoiceId,
  balanceMinor,
  today,
}: {
  invoiceId: number;
  balanceMinor: number;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => minorToRupeesInput(balanceMinor));
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'card'>('cash');
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function show() {
    setAmount(minorToRupeesInput(balanceMinor));
    setMethod('cash');
    setPaidOn(today);
    setReference('');
    setNote('');
    setError(null);
    setMessage(null);
    setOpen(true);
  }

  function hide() {
    if (pending) return;
    setOpen(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || message) return;
    const amountMinor = rupeesToMinor(amount);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter a payment amount in rupees.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await recordPaymentAction({
        invoiceId,
        amountMinor,
        method,
        paidOn,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setMessage(`Payment recorded. New balance: ${formatLkr(response.balanceMinor, { decimals: true })}.`);
      router.refresh();
    } catch (error) {
      console.error('[invoices] could not record payment:', error);
      setError('We could not record that payment. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={show} disabled={balanceMinor <= 0}>Record payment</Button>
      <Modal open={open} onClose={hide} title="Record a payment">
            <p className="mt-1 text-base sm:text-sm text-mute">
              Balance before this payment: {formatLkr(balanceMinor, { decimals: true })}.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-4">
              <Field label="Amount (Rs.)" htmlFor="payment-amount">
                <Input
                  id="payment-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  autoFocus
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Method" htmlFor="payment-method">
                  <Select
                    id="payment-method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as typeof method)}
                  >
                    {methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </Field>
                <Field label="Date" htmlFor="payment-date">
                  <Input
                    id="payment-date"
                    type="date"
                    value={paidOn}
                    onChange={(event) => setPaidOn(event.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field label="Reference (optional)" htmlFor="payment-reference">
                <Input
                  id="payment-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </Field>
              <Field label="Note (optional)" htmlFor="payment-note">
                <Textarea
                  id="payment-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              {error ? <p role="status" aria-live="polite" className="text-base sm:text-sm text-bad">{error}</p> : null}
              {message ? <p role="status" className="text-base sm:text-sm text-good">{message}</p> : null}
              <div data-sticky-bar className={
                'sticky bottom-0 z-20 flex flex-wrap gap-3 border-t border-line bg-paper p-3 '
                + 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
              }>
                <Button type="submit" disabled={pending || Boolean(message)}>
                  {pending ? 'Recording…' : 'Record payment'}
                </Button>
                <Button variant="ghost" onClick={hide} disabled={pending}>Close</Button>
              </div>
            </form>
      </Modal>
    </>
  );
}

'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { addCustomerAction } from '@/app/admin/(panel)/invoices/actions';
import { searchCustomersAction } from '@/app/admin/(panel)/invoices/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/field';
import { Textarea } from '@/components/ui/field';
import type { BuilderCustomer } from '@/lib/admin/invoices';
import type { CustomerOption } from '@/lib/admin/invoices';

const emptyForm = { name: '', phone: '', address: '', email: '' };

export function CustomerPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: BuilderCustomer | null;
  onSelect: (customer: BuilderCustomer) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [result, setResult] = useState<{ term: string; rows: CustomerOption[] }>({ term: '', rows: [] });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      searchCustomersAction(term)
        .then((rows) => {
          if (active) {
            setResult({ term, rows });
            setSearchError('');
          }
        })
        .catch(() => {
          if (active) {
            setResult({ term, rows: [] });
            setSearchError('The search could not be loaded. Change the search text to try again.');
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  if (selected) {
    return (
      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{selected.name}</p>
            <p className="text-base sm:text-sm text-ink-2">{selected.phone}</p>
            {selected.address ? <p className="mt-1 text-base sm:text-sm text-mute">{selected.address}</p> : null}
            {selected.email ? <p className="text-base sm:text-sm text-mute">{selected.email}</p> : null}
          </div>
          <Button variant="subtle" size="sm" onClick={onClear}>Change customer</Button>
        </div>
      </div>
    );
  }

  const rows = result.term === term ? result.rows : [];
  const searching = term.length >= 2 && result.term !== term;

  function choose(customer: BuilderCustomer) {
    setError(null);
    setQuery('');
    setResult({ term: '', rows: [] });
    setAdding(false);
    onSelect(customer);
  }

  async function addCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await addCustomerAction(form);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setForm(emptyForm);
      choose(response.customer);
    } catch (error) {
      console.error('[invoices] could not add customer:', error);
      setError('We could not add that customer. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field
        label="Search customers"
        htmlFor="customer-search"
        hint="Type at least two letters of a name, or a phone number."
      >
        <Input
          id="customer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or phone"
          autoComplete="off"
        />
      </Field>
      <div aria-live="polite" className="text-base sm:text-sm text-mute">
        {result.term === term ? searchError : null}
        {searching ? 'Searching…' : null}
        {term.length >= 2 && !searching && rows.length === 0 && !searchError ? 'No matching customer yet.' : null}
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
          {rows.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => choose(customer)}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bone"
              >
                <span>
                  <span className="block font-medium">{customer.name}</span>
                  <span className="block text-base sm:text-sm text-mute">{customer.phone}</span>
                </span>
                {customer.city ? <span className="text-base sm:text-sm text-mute">{customer.city}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={addCustomer} className="space-y-4 rounded-xl border border-line bg-paper p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="new-customer-name">
              <Input
                id="new-customer-name" autoComplete="name"
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Phone" htmlFor="new-customer-phone" hint="Sri Lankan mobile or landline.">
              <Input
                id="new-customer-phone" autoComplete="tel" inputMode="tel"
                required
                type="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="077 123 4567"
              />
            </Field>
          </div>
          <Field label="Address" htmlFor="new-customer-address">
            <Textarea
              id="new-customer-address" autoComplete="street-address"
              rows={2}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </Field>
          <Field label="Email (optional)" htmlFor="new-customer-email">
            <Input
              id="new-customer-email" autoComplete="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <FieldError>{error}</FieldError>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Adding…' : 'Add customer'}</Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="subtle" size="sm" onClick={() => setAdding(true)}>Add new customer</Button>
      )}
    </div>
  );
}

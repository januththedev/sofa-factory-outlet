import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

export type InvoiceFilterValues = {
  q: string;
  status: string;
  source: string;
  from: string;
  to: string;
};

export function InvoiceFilters({
  tab,
  values,
}: {
  tab: 'invoices' | 'quotations';
  values: InvoiceFilterValues;
}) {
  return (
    <form method="get" action="/admin/invoices/" className="grid gap-4 border-b border-line pb-6 md:grid-cols-12">
      <input type="hidden" name="tab" value={tab} />
      <Field label="Search" htmlFor="invoice-search" className="md:col-span-4">
        <Input
          id="invoice-search"
          name="q"
          type="search"
          defaultValue={values.q}
          placeholder="Number, customer or phone"
        />
      </Field>
      <Field label="Status" htmlFor="invoice-status" className="md:col-span-2">
        <Select id="invoice-status" name="status" defaultValue={values.status}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="partially_paid">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Field>
      <Field label="Source" htmlFor="invoice-source" className="md:col-span-2">
        <Select id="invoice-source" name="source" defaultValue={values.source}>
          <option value="">All sources</option>
          <option value="website">Website</option>
          <option value="walk-in">Walk-in</option>
        </Select>
      </Field>
      <Field label="From" htmlFor="invoice-from" className="md:col-span-2">
        <Input id="invoice-from" name="from" type="date" defaultValue={values.from} />
      </Field>
      <Field label="To" htmlFor="invoice-to" className="md:col-span-2">
        <Input id="invoice-to" name="to" type="date" defaultValue={values.to} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 md:col-span-12">
        <Button type="submit" size="sm">Filter</Button>
        <Link href={`/admin/invoices/?tab=${tab}`} className="text-sm text-mute underline-offset-4 hover:underline">
          Clear filters
        </Link>
      </div>
    </form>
  );
}

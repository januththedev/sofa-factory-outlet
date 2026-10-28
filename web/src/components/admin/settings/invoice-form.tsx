'use client';

import Image from 'next/image';
import { saveInvoiceAction } from '@/app/admin/(panel)/settings/actions';
import type { InvoiceSettings } from '@/lib/settings/types';
import { AreaField } from './form-kit';
import { CheckField } from './form-kit';
import { ConfirmedField } from './form-kit';
import { FormCard } from './form-kit';
import { SaveBar } from './form-kit';
import { SectionTitle } from './form-kit';
import { TextField } from './form-kit';
import { useSettingsForm } from './form-kit';

type InvoiceFormProps = { invoice: InvoiceSettings; taxRatePercent: string; businessName: string };

export function InvoiceForm({ invoice, taxRatePercent, businessName }: InvoiceFormProps) {
  const { state, pending, onSubmit, error } = useSettingsForm(saveInvoiceAction);
  return (
    <FormCard onSubmit={onSubmit} aria-label="Invoice settings">
      <section className="space-y-4">
        <SectionTitle title="Numbering">
          Invoices are numbered with the prefix, then a running number. Changing a prefix affects new documents only.
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="prefix"
            label="Invoice prefix"
            defaultValue={invoice.prefix}
            error={error('prefix')}
            hint="For example SFO."
          />
          <TextField
            name="quotationPrefix"
            label="Quotation prefix"
            defaultValue={invoice.quotationPrefix}
            error={error('quotationPrefix')}
            hint="For example SFO-Q."
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Tax">Switch tax on only if the business is VAT registered.</SectionTitle>
        <CheckField name="taxEnabled" label="Add tax to invoices" defaultChecked={invoice.taxEnabled} />
        <div className="grid gap-4 md:grid-cols-3">
          <TextField name="taxLabel" label="Tax label" defaultValue={invoice.taxLabel} error={error('taxLabel')} />
          <TextField
            name="taxRatePercent"
            label="Rate (%)"
            inputMode="decimal"
            defaultValue={taxRatePercent}
            error={error('taxRatePercent')}
            hint="For example 18."
          />
          <TextField
            name="vatNumber"
            label="VAT number"
            defaultValue={invoice.vatNumber ?? ''}
            error={error('vatNumber')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Bank details">Printed on invoices so customers know where to pay.</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="bank.bank" label="Bank" defaultValue={invoice.bank.bank ?? ''} error={error('bank.bank')} />
          <TextField
            name="bank.branch"
            label="Branch"
            defaultValue={invoice.bank.branch ?? ''}
            error={error('bank.branch')}
          />
          <TextField
            name="bank.accountName"
            label="Account name"
            defaultValue={invoice.bank.accountName ?? ''}
            error={error('bank.accountName')}
          />
          <TextField
            name="bank.accountNumber"
            label="Account number"
            defaultValue={invoice.bank.accountNumber ?? ''}
            error={error('bank.accountNumber')}
            inputMode="numeric"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Terms and warranty" confirmed={invoice.confirmed}>
          Printed at the foot of every invoice. Each invoice can still change its own terms.
        </SectionTitle>
        <AreaField name="terms" label="Default terms" defaultValue={invoice.terms} error={error('terms')} rows={4} />
        <AreaField
          name="warranty"
          label="Warranty text"
          defaultValue={invoice.warranty}
          error={error('warranty')}
          rows={3}
        />
        <ConfirmedField name="confirmed" defaultChecked={invoice.confirmed} error={error('confirmed')} />
      </section>

      <section>
        <SectionTitle title="Logo">The logo printed at the top of invoices and quotations.</SectionTitle>
        <div className="inline-block rounded-xl border border-line bg-white p-4">
          <Image
            src="/brand/logo.png"
            alt={`${businessName} logo`}
            width={180}
            height={72}
            className="h-14 w-auto object-contain"
          />
        </div>
        <p
          className="mt-2 text-base sm:text-sm text-mute">
          To change the logo, replace public/brand/logo.png in the site files.
        </p>
      </section>

      <SaveBar state={state} pending={pending} />
    </FormCard>
  );
}

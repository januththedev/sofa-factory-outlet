'use client';

import { saveDeliveryAction, saveProofAction } from '@/app/admin/(panel)/settings/actions';
import type { DeliverySettings, ProofSettings } from '@/lib/settings/types';
import { AreaField, ConfirmedField, FormCard, SaveBar, SectionTitle, TextField, useSettingsForm } from './form-kit';

export function DeliveryForm({ delivery }: { delivery: DeliverySettings }) {
  const { state, pending, onSubmit, error } = useSettingsForm(saveDeliveryAction);
  return (
    <FormCard onSubmit={onSubmit} aria-label="Delivery and warranty">
      <SectionTitle title="Delivery and warranty" confirmed={delivery.confirmed}>
        Shown on the delivery page, the product pages and in chat answers. Only write what the client has confirmed.
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          name="delivery.colomboDays"
          label="Delivery time in Colombo"
          defaultValue={delivery.colomboDays}
          error={error('delivery.colomboDays')}
        />
        <TextField
          name="delivery.islandwideDays"
          label="Delivery time islandwide"
          defaultValue={delivery.islandwideDays}
          error={error('delivery.islandwideDays')}
        />
        <TextField
          name="delivery.colomboCharge"
          label="Delivery charge in Colombo"
          defaultValue={delivery.colomboCharge}
          error={error('delivery.colomboCharge')}
        />
        <TextField
          name="delivery.islandwideCharge"
          label="Delivery charge islandwide"
          defaultValue={delivery.islandwideCharge}
          error={error('delivery.islandwideCharge')}
        />
      </div>
      <AreaField
        name="delivery.warranty"
        label="Warranty"
        defaultValue={delivery.warranty}
        error={error('delivery.warranty')}
        rows={3}
      />
      <ConfirmedField
        name="delivery.confirmed"
        defaultChecked={delivery.confirmed}
        error={error('delivery.confirmed')}
      />
      <SaveBar state={state} pending={pending} />
    </FormCard>
  );
}

export function ProofForm({ proof }: { proof: ProofSettings }) {
  const { state, pending, onSubmit, error } = useSettingsForm(saveProofAction);
  const value = (n: number | null) => (n === null ? '' : String(n));
  return (
    <FormCard onSubmit={onSubmit} aria-label="Proof numbers">
      <SectionTitle title="Proof numbers" confirmed={proof.confirmed}>
        Figures such as years trading are shown on the site only when the client has confirmed them. Leave a number
        empty if the client does not want to state it.
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          name="proof.years"
          label="Years trading"
          inputMode="numeric"
          defaultValue={value(proof.years)}
          error={error('proof.years')}
        />
        <TextField
          name="proof.homes"
          label="Homes furnished"
          inputMode="numeric"
          defaultValue={value(proof.homes)}
          error={error('proof.homes')}
        />
        <TextField
          name="proof.districts"
          label="Districts delivered to"
          inputMode="numeric"
          defaultValue={value(proof.districts)}
          error={error('proof.districts')}
        />
      </div>
      <ConfirmedField name="proof.confirmed" defaultChecked={proof.confirmed} error={error('proof.confirmed')} />
      <SaveBar state={state} pending={pending} />
    </FormCard>
  );
}

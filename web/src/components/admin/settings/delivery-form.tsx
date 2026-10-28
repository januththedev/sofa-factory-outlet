'use client';

import { saveDeliveryAction } from '@/app/admin/(panel)/settings/actions';
import { saveProofAction } from '@/app/admin/(panel)/settings/actions';
import type { DeliverySettings } from '@/lib/settings/types';
import type { ProofSettings } from '@/lib/settings/types';
import { AreaField } from './form-kit';
import { ConfirmedField } from './form-kit';
import { FormCard } from './form-kit';
import { FormStatus } from './form-kit';
import { SectionTitle } from './form-kit';
import { TextField } from './form-kit';
import { useSettingsForm } from './form-kit';
import { Button } from '@/components/ui/button';

export function DeliveryProofForm({ delivery, proof }: { delivery: DeliverySettings; proof: ProofSettings }) {
  const deliveryForm = useSettingsForm(saveDeliveryAction);
  const proofForm = useSettingsForm(saveProofAction);
  const value = (n: number | null) => n === null ? '' : String(n);
  return (
    <div className="space-y-6 pb-36">
    <FormCard id="delivery-settings" onSubmit={deliveryForm.onSubmit} aria-label="Delivery and warranty">
      <SectionTitle title="Delivery and warranty" confirmed={delivery.confirmed}>
        Shown on the delivery page, the product pages and in chat answers. Only write what the client has confirmed.
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          name="delivery.colomboDays"
          label="Delivery time in Colombo"
          defaultValue={delivery.colomboDays}
          error={deliveryForm.error('delivery.colomboDays')}
        />
        <TextField
          name="delivery.islandwideDays"
          label="Delivery time islandwide"
          defaultValue={delivery.islandwideDays}
          error={deliveryForm.error('delivery.islandwideDays')}
        />
        <TextField
          name="delivery.colomboCharge"
          label="Delivery charge in Colombo"
          defaultValue={delivery.colomboCharge}
          error={deliveryForm.error('delivery.colomboCharge')}
        />
        <TextField
          name="delivery.islandwideCharge"
          label="Delivery charge islandwide"
          defaultValue={delivery.islandwideCharge}
          error={deliveryForm.error('delivery.islandwideCharge')}
        />
      </div>
      <AreaField
        name="delivery.warranty"
        label="Warranty"
        defaultValue={delivery.warranty}
        error={deliveryForm.error('delivery.warranty')}
        rows={3}
      />
      <ConfirmedField
        name="delivery.confirmed"
        defaultChecked={delivery.confirmed}
        error={deliveryForm.error('delivery.confirmed')}
      />

    </FormCard>
    <FormCard id="proof-settings" onSubmit={proofForm.onSubmit} aria-label="Proof numbers">
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
          error={proofForm.error('proof.years')}
        />
        <TextField
          name="proof.homes"
          label="Homes furnished"
          inputMode="numeric"
          defaultValue={value(proof.homes)}
          error={proofForm.error('proof.homes')}
        />
        <TextField
          name="proof.districts"
          label="Districts delivered to"
          inputMode="numeric"
          defaultValue={value(proof.districts)}
          error={proofForm.error('proof.districts')}
        />
      </div>
      <ConfirmedField name="proof.confirmed" defaultChecked={proof.confirmed}
        error={proofForm.error('proof.confirmed')} />

    </FormCard>
      <div data-sticky-bar className={
        'sticky bottom-0 z-20 space-y-2 rounded-xl border border-line bg-paper p-3 '
        + 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
      }>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" form="delivery-settings" disabled={deliveryForm.pending || proofForm.pending}>
            {deliveryForm.pending ? 'Saving…' : 'Save delivery'}
          </Button>
          <Button type="submit" form="proof-settings" disabled={deliveryForm.pending || proofForm.pending}>
            {proofForm.pending ? 'Saving…' : 'Save proof numbers'}
          </Button>
        </div>
        <FormStatus state={deliveryForm.state} pending={deliveryForm.pending} />
        <FormStatus state={proofForm.state} pending={proofForm.pending} />
      </div>
    </div>
  );
}

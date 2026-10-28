'use client';

import type { ComponentProps } from 'react';
import { saveBusinessAction } from '@/app/admin/(panel)/settings/actions';
import type { BusinessSettings } from '@/lib/settings/types';
import { ConfirmedField, FormCard, SaveBar, SectionTitle, TextField, useSettingsForm } from './form-kit';

type Extra = Partial<ComponentProps<typeof TextField>>;

export function BusinessForm({ business }: { business: BusinessSettings }) {
  const { state, pending, onSubmit, error } = useSettingsForm(saveBusinessAction);
  const field = (name: string, label: string, value: string | null, extra: Extra = {}) => (
    <TextField name={name} label={label} defaultValue={value ?? ''} error={error(name)} {...extra} />
  );
  const confirmed = (name: string, value: boolean) => (
    <ConfirmedField name={name} defaultChecked={value} error={error(name)} />
  );

  return (
    <FormCard onSubmit={onSubmit} aria-label="Business details">
      <section>
        <SectionTitle title="Business">
          The name and line shown in the header, the footer and search results.
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {field('name', 'Business name', business.name, { required: true })}
          {field('priceRange', 'Price range text', business.priceRange, { hint: 'For example LKR.' })}
          {field('tagline', 'Tagline', business.tagline, { className: 'md:col-span-2' })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Showroom address" confirmed={business.address.confirmed} />
        <div className="grid gap-4 md:grid-cols-2">
          {field('address.street', 'Street', business.address.street, { autoComplete: 'street-address' })}
          {field('address.locality', 'Area', business.address.locality)}
          {field('address.city', 'City', business.address.city)}
          {field('address.postalCode', 'Postal code', business.address.postalCode)}
        </div>
        {confirmed('address.confirmed', business.address.confirmed)}
      </section>

      <section className="space-y-4">
        <SectionTitle title="Phone" confirmed={business.phone.confirmed} />
        <div className="grid gap-4 md:grid-cols-2">
          {field('phone.number', 'Phone number', business.phone.number, {
            inputMode: 'tel',
            autoComplete: 'tel',
            hint: 'Saved in the +94 format.',
          })}
        </div>
        {confirmed('phone.confirmed', business.phone.confirmed)}
      </section>

      <section className="space-y-4">
        <SectionTitle title="WhatsApp" confirmed={business.whatsapp.confirmed} />
        <div className="grid gap-4 md:grid-cols-2">
          {field('whatsapp.number', 'WhatsApp number', business.whatsapp.number, {
            inputMode: 'tel',
            hint: 'Used for the chat handoff and the message links.',
          })}
        </div>
        {confirmed('whatsapp.confirmed', business.whatsapp.confirmed)}
      </section>

      <section className="space-y-4">
        <SectionTitle title="Email" confirmed={business.email.confirmed} />
        <div className="grid gap-4 md:grid-cols-2">
          {field('email.address', 'Public email address', business.email.address, {
            type: 'email',
            autoComplete: 'email',
          })}
        </div>
        {confirmed('email.confirmed', business.email.confirmed)}
      </section>

      <section>
        <SectionTitle title="Social media">
          Links must start with https://. Leave a field empty if there is no page.
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {field('social.facebook', 'Facebook', business.social.facebook, { inputMode: 'url' })}
          {field('social.instagram', 'Instagram', business.social.instagram, { inputMode: 'url' })}
          {field('social.tiktok', 'TikTok', business.social.tiktok, { inputMode: 'url' })}
          {field('social.youtube', 'YouTube', business.social.youtube, { inputMode: 'url' })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Map and Google reviews" confirmed={business.map.confirmed} />
        <div className="grid gap-4 md:grid-cols-2">
          {field('map.placeUrl', 'Google Maps link', business.map.placeUrl, {
            inputMode: 'url',
            hint: 'The Share link from the Google Maps listing.',
          })}
          {field('map.googleReviewUrl', 'Google review link', business.map.googleReviewUrl, {
            inputMode: 'url',
            hint: 'Sent to customers by the review request message.',
          })}
        </div>
        {confirmed('map.confirmed', business.map.confirmed)}
      </section>

      <SaveBar state={state} pending={pending} />
    </FormCard>
  );
}

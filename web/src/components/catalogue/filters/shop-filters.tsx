'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ShopResult } from '@/lib/catalogue/search';
import { changeFilter } from '../filter-state';
import { priceRangeError } from '../filter-state';
import { selectedValues } from '../filter-state';

export type CategoryOption = { path: string; name: string };

type Props = {
  facets: ShopResult['facets'];
  categories: CategoryOption[];
  showCategories?: boolean;
  query: string;
  onChange: (query: URLSearchParams) => void;
  collapsible?: boolean;
};

export function ShopFilters({
  facets,
  categories,
  showCategories = true,
  query,
  onChange,
  collapsible = false,
}: Props) {
  const current = new URLSearchParams(query);
  const priceErrorId = useId();
  const priceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [priceDraft, setPriceDraft] = useState({
    source: query,
    minPrice: current.get('minPrice') ?? '',
    maxPrice: current.get('maxPrice') ?? '',
  });
  const priceValues = priceDraft.source === query ? priceDraft : {
    minPrice: current.get('minPrice') ?? '',
    maxPrice: current.get('maxPrice') ?? '',
  };
  const priceQuery = (values: { minPrice: string; maxPrice: string }) => {
    const next = new URLSearchParams(query);
    for (const key of ['minPrice', 'maxPrice'] as const) {
      if (values[key]) next.set(key, values[key]);
      else next.delete(key);
    }
    next.delete('page');
    return next;
  };
  const priceError = priceRangeError(priceQuery(priceValues));
  useEffect(() => () => clearTimeout(priceTimer.current), [query]);
  const changePrice = (key: 'minPrice' | 'maxPrice', value: string) => {
    const values = { ...priceValues, [key]: value };
    setPriceDraft({ ...values, source: query });
    const next = priceQuery(values);
    clearTimeout(priceTimer.current);
    if (collapsible) onChange(next);
    else if (!priceRangeError(next)) {
      priceTimer.current = setTimeout(() => onChange(next), 250);
    }
  };
  const setValue = (key: string, value: string) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    onChange(next);
  };
  const group = (label: string, key: 'colour' | 'material' | 'shape' | 'seats') => {
    const selected = selectedValues(current, key);
    const options = [...facets[key]];
    for (const value of selected) {
      if (!options.some((option) => option.value === value)) {
        options.push({ value, label: value.replace(/-/g, ' '), count: 0 });
      }
    }
    const fields = (
      <fieldset className="min-w-0 py-3">
        <legend className={collapsible ? 'sr-only' : 'font-display text-lg'}>{label}</legend>
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option.value} className="relative flex min-h-11 cursor-pointer items-center gap-3
              rounded focus-within:outline-2 focus-within:outline-maroon text-base">
              <input
                type="checkbox"
                className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                checked={selected.includes(option.value)}
                onChange={(event) => onChange(changeFilter(current, key, option.value, event.target.checked))}
              />
              <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded border
                border-ink peer-checked:border-maroon peer-checked:bg-maroon peer-checked:text-bone">
                {selected.includes(option.value) ? '✓' : ''}
              </span>
              {option.hex ? (
                <span
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-full border border-line"
                  style={{ backgroundColor: option.hex }}
                />
              ) : null}
              <span className="capitalize">{option.label}</span>
              <span className="ml-auto text-mute">{option.count}</span>
            </label>
          ))}
          {!options.length ? <p className="py-3 text-base text-mute">No options for these filters.</p> : null}
        </div>
      </fieldset>
    );
    return collapsible ? (
      <details key={key} open={key === 'colour'} className="border-t border-line">
        <summary className="min-h-11 cursor-pointer py-3 font-display text-lg">{label}</summary>
        {fields}
      </details>
    ) : <div key={key} className="border-t border-line py-3">{fields}</div>;
  };
  const price = (
    <div className="grid grid-cols-2 gap-3 py-3">
      {(['minPrice', 'maxPrice'] as const).map((key) => (
        <label key={key} className="min-w-0 text-base">
          <span className="mb-2 block">{key === 'minPrice' ? 'Min (Rs.)' : 'Max (Rs.)'}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="100000000"
            step="1"
            value={priceValues[key]}
            aria-invalid={Boolean(priceError)}
            aria-describedby={priceError ? priceErrorId : undefined}
            placeholder={String(facets.price[key === 'minPrice' ? 'min' : 'max'] ?? '')}
            onChange={(event) => changePrice(key, event.target.value)}
            className="min-h-11 w-full rounded-lg border border-line bg-bone px-2 text-base"
          />
        </label>
      ))}
      {priceError ? <p id={priceErrorId} role="alert" className="col-span-2 text-base">{priceError}</p> : null}
    </div>
  );
  return (
    <div aria-label="Product filters">
      {showCategories ? (
        <label className="block pb-5 text-base">
          <span className="mb-2 block font-display text-lg">Category</span>
          <select
            className="min-h-11 w-full rounded-lg border border-line bg-bone p-3 text-base"
            value={current.get('category') ?? ''}
            onChange={(event) => setValue('category', event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option value={category.path} key={category.path}>{category.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {group('Colour', 'colour')}
      {group('Material', 'material')}
      {group('Shape', 'shape')}
      {group('Seats', 'seats')}
      {collapsible ? (
        <details className="border-t border-line">
          <summary className="min-h-11 cursor-pointer py-3 font-display text-lg">Price</summary>
          {price}
        </details>
      ) : (
        <fieldset className="border-t border-line py-3">
          <legend className="font-display text-lg">Price</legend>
          {price}
        </fieldset>
      )}
    </div>
  );
}

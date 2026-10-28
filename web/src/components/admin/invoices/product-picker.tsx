'use client';

import { useEffect, useState } from 'react';
import { searchProductsAction } from '@/app/admin/(panel)/invoices/actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Label } from '@/components/ui/field';
import { minorToRupeesInput, type ProductOption } from '@/lib/admin/invoices';
import { formatLkr } from '@/lib/money';

const selectClass = 'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none '
  + 'focus:border-maroon focus:ring-2 focus:ring-maroon/15';

export type CatalogueLine = {
  productId: number;
  variantId?: number;
  description: string;
  colourName?: string;
  unitPrice: string;
  priceOnRequest: boolean;
};

export function ProductPicker({ onAdd }: { onAdd: (line: CatalogueLine) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ term: string; rows: ProductOption[] }>({ term: '', rows: [] });
  const [variantByProduct, setVariantByProduct] = useState<Record<number, number>>({});
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      searchProductsAction(term)
        .then((rows) => {
          if (active) setResult({ term, rows });
        })
        .catch(() => {
          if (active) setResult({ term, rows: [] });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  const rows = result.term === term ? result.rows : [];
  const searching = term.length >= 2 && result.term !== term;

  function addProduct(product: ProductOption) {
    const variantId = variantByProduct[product.id] ?? product.variants[0]?.id;
    const variant = product.variants.find((item) => item.id === variantId);
    onAdd({
      productId: product.id,
      variantId: variant?.id,
      description: product.name,
      colourName: variant?.colourName,
      unitPrice: minorToRupeesInput(product.priceMinor),
      priceOnRequest: product.priceOnRequest,
    });
    setQuery('');
    setResult({ term: '', rows: [] });
  }

  return (
    <div className="space-y-3">
      <Field label="Add from the catalogue" htmlFor="product-search" hint="Search published products by name.">
        <Input
          id="product-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sofa, bed, chair…"
          autoComplete="off"
        />
      </Field>
      <div aria-live="polite" className="text-sm text-mute">
        {searching ? 'Searching…' : null}
        {term.length >= 2 && !searching && rows.length === 0 ? 'No published product matches that name.' : null}
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
          {rows.map((product) => {
            const variants = product.variants;
            const chosen = variantByProduct[product.id] ?? variants[0]?.id ?? 0;
            return (
              <li key={product.id} className="grid gap-3 px-4 py-4 sm:grid-cols-12 sm:items-end">
                <div className="sm:col-span-5">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-mute">
                    {product.priceOnRequest
                      ? 'Price on request'
                      : formatLkr(product.priceMinor, { decimals: true })}
                  </p>
                </div>
                <div className="sm:col-span-4">
                  {variants.length ? (
                    <>
                      <Label htmlFor={`product-colour-${product.id}`}>Colour</Label>
                      <select
                        id={`product-colour-${product.id}`}
                        value={chosen}
                        onChange={(event) => setVariantByProduct({
                          ...variantByProduct,
                          [product.id]: Number(event.target.value),
                        })}
                        className={selectClass}
                      >
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.colourName}{variant.inStock ? '' : ' — out of stock'}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : <p className="pb-2 text-sm text-mute">No colour variants</p>}
                </div>
                <div className="sm:col-span-3 sm:text-right">
                  <Button size="sm" onClick={() => addProduct(product)}>Add line</Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

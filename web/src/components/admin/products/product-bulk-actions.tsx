'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { bulkProductsAction } from '@/app/admin/(panel)/products/actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';

type Props = {
  ids: number[];
  owner: boolean;
};

export function ProductBulkActions({ ids, owner }: Props) {
  const router = useRouter();
  const [operation, setOperation] = useState<'publish' | 'hide' | 'delete'>('publish');
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function apply() {
    if (pending) return;
    if (!selected.length) {
      setMessage('Select at least one product.');
      return;
    }
    if (operation === 'delete' && !window.confirm(`Delete ${selected.length} products?`)) return;
    setMessage('Applying…');
    setPending(true);
    try {
      const result = await bulkProductsAction({ ids: selected, operation });
      setMessage(result.ok ? 'Products updated.' : result.error);
      if (result.ok) {
        setSelected([]);
        router.refresh();
      }
    } catch {
      setMessage('The products could not be updated. Your selection is kept. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-4 rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-44 text-base sm:text-sm font-medium">
          Bulk action
          <Select
            className="mt-1"
            disabled={pending}
            value={operation}
            onChange={(event) => setOperation(event.target.value as typeof operation)}
          >
            <option value="publish">Publish</option>
            <option value="hide">Hide</option>
            {owner ? <option value="delete">Delete</option> : null}
          </Select>
        </label>
        <Button onClick={() => void apply()} disabled={pending}>
          {pending ? 'Applying…' : `Apply to ${selected.length} selected`}
        </Button>
        <span className="text-base sm:text-sm text-mute" aria-live="polite">{message}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {ids.map((id) => (
          <label key={id} className="text-base sm:text-sm">
            <input
              className="mr-1"
              type="checkbox"
              disabled={pending}
              checked={selected.includes(id)}
              onChange={(event) => setSelected((current) => (
                event.target.checked ? [...current, id] : current.filter((item) => item !== id)
              ))}
            />
            #{id}
          </label>
        ))}
      </div>
    </div>
  );
}

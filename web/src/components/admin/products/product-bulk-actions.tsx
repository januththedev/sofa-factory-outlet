'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { bulkProductsAction } from '@/app/admin/(panel)/products/actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';

type Props = {
  /** How many products are listed on this page (for "Select all"). */
  total: number;
  owner: boolean;
};

const BOX = 'input[data-bulk-select]';

const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(BOX));
const chosenIds = () => [...new Set(
  boxes().filter((box) => box.checked).map((box) => Number(box.value)),
)];

/**
 * Bulk publish, hide or delete. The checkboxes live in each product's own card and table row
 * (`input[data-bulk-select]`, value = product id); this panel reads them, so the owner ticks the
 * product they can see instead of a bare id.
 */
export function ProductBulkActions({ total, owner }: Props) {
  const router = useRouter();
  const [operation, setOperation] = useState<'publish' | 'hide' | 'delete'>('publish');
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onChange(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.matches(BOX)) return;
      // The phone card and the desktop row of one product share a state.
      for (const box of boxes()) if (box.value === target.value) box.checked = target.checked;
      setCount(chosenIds().length);
    }
    document.addEventListener('change', onChange);
    return () => document.removeEventListener('change', onChange);
  }, []);

  function selectAll(checked: boolean) {
    for (const box of boxes()) box.checked = checked;
    setCount(chosenIds().length);
  }

  async function apply() {
    if (pending) return;
    const ids = chosenIds();
    if (!ids.length) {
      setMessage('Tick at least one product first.');
      return;
    }
    if (operation === 'delete' && !window.confirm(`Delete ${ids.length} product${ids.length === 1 ? '' : 's'}?`)) return;
    setMessage('Applying…');
    setPending(true);
    // The row boxes are server-rendered, so lock them here: a tick made mid-request would not be applied.
    const lock = (locked: boolean) => { for (const box of boxes()) box.disabled = locked; };
    lock(true);
    try {
      const result = await bulkProductsAction({ ids, operation });
      setMessage(result.ok ? 'Products updated.' : result.error);
      if (result.ok) {
        selectAll(false);
        router.refresh();
      }
    } catch {
      setMessage('The products could not be updated. Your selection is kept. Please try again.');
    } finally {
      lock(false);
      setPending(false);
    }
  }

  return (
    <div className="mb-4 rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="inline-flex min-h-11 items-center gap-2 text-base font-medium sm:text-sm">
          <input
            type="checkbox"
            className="size-5 accent-maroon"
            disabled={pending || total === 0}
            checked={total > 0 && count >= total}
            onChange={(event) => selectAll(event.target.checked)}
          />
          Select all {total} on this page
        </label>
        <label className="min-w-40 text-base font-medium sm:text-sm">
          Then
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
        <Button onClick={() => void apply()} disabled={pending || count === 0}>
          {pending ? 'Applying…' : count === 0 ? 'Tick products to apply' : `Apply to ${count} selected`}
        </Button>
        <span className="text-base text-mute sm:text-sm" aria-live="polite">{message}</span>
      </div>
    </div>
  );
}

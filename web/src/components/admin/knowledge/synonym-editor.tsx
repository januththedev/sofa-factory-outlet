'use client';

import { Download } from 'lucide-react';
import { X } from 'lucide-react';
import { useId } from 'react';
import { useState } from 'react';
import { deleteSynonymAction } from '@/app/admin/(panel)/knowledge/actions';
import { saveSynonymAction } from '@/app/admin/(panel)/knowledge/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Label } from '@/components/ui/field';
import { Status } from './status';

export type SynonymView = { id: number; term: string; variants: string[]; source: 'starter' | 'upload' | 'admin' };

/** Adds a word to a list unless it is empty or already there (ignoring case). */
function withVariant(list: string[], word: string): string[] {
  const clean = word.trim();
  if (!clean || list.some((item) => item.toLocaleLowerCase('en') === clean.toLocaleLowerCase('en'))) return list;
  return [...list, clean];
}

function sourceLabel(source: SynonymView['source']): string {
  if (source === 'starter') return 'Starter pack';
  return source === 'upload' ? 'Import' : 'Edited here';
}

/** Chips for the variants of one term, with an input to add another. Saved with its own button. */
function SynonymRow({ row }: { row: SynonymView }) {
  const inputId = useId();
  const [variants, setVariants] = useState(row.variants);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const dirty = variants.join('\u0000') !== row.variants.join('\u0000') || draft.trim() !== '';

  function add() {
    setVariants((list) => withVariant(list, draft));
    setDraft('');
  }

  async function save() {
    const next = withVariant(variants, draft);
    setBusy(true);
    setMessage(null);
    try {
      const result = await saveSynonymAction({ term: row.term, variants: next });
      if (result.ok) {
        setVariants(result.entry.variants);
        setDraft('');
        setMessage({ tone: 'good', text: 'Saved.' });
      } else {
        setMessage({ tone: 'bad', text: result.error });
      }
    } catch {
      setMessage({ tone: 'bad', text: 'That could not be saved. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await deleteSynonymAction({ id: row.id });
      if (!result.ok) setMessage({ tone: 'bad', text: result.error });
    } catch {
      setMessage({ tone: 'bad', text: 'That could not be deleted. Please try again.' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <li className="m-3 min-w-0 space-y-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{row.term}</p>
        <Badge tone="neutral">{sourceLabel(row.source)}</Badge>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label={`Variants of ${row.term}`}>
        {variants.map((variant) => (
          <li key={variant}
            className="inline-flex items-center gap-1 rounded-full bg-bone-2 py-1 pl-3 pr-1 text-base
            sm:text-sm">
            {variant}
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remove "${variant}" from this term? Save to apply the change.`)) {
                  setVariants((list) => list.filter((item) => item !== variant));
                }
              }}
              aria-label={`Remove ${variant}`}
              disabled={busy}
              className="grid min-h-11 min-w-11 place-items-center rounded-full text-mute hover:text-bad"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <Label htmlFor={inputId}>Add a variant to {row.term}</Label>
          <Input
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
            placeholder="Another way people say it"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={add} disabled={busy || draft.trim() === ''}>
          Add
        </Button>
        <Button size="sm" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-base sm:text-sm">
            Delete this term?
            <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
              Yes, delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="link" onClick={() => setConfirming(true)} disabled={busy} className="text-bad">
            Delete
          </Button>
        )}
      </div>
      <Status tone={message?.tone ?? 'info'}>{message?.text}</Status>
    </li>
  );
}

/** A new term with its first variants, typed as a comma separated list. */
function AddTerm() {
  const base = useId();
  const [term, setTerm] = useState('');
  const [variants, setVariants] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const list = variants
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await saveSynonymAction({ term, variants: list });
      if (result.ok) {
        setTerm('');
        setVariants('');
        setMessage({ tone: 'good', text: `Added ${result.entry.term}.` });
      } else {
        setMessage({ tone: 'bad', text: result.error });
      }
    } catch {
      setMessage({ tone: 'bad', text: 'That could not be saved. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-b border-line px-6 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <Label htmlFor={`${base}-term`}>Term</Label>
          <Input
            id={`${base}-term`}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="l-shape"
            required
          />
        </div>
        <div className="min-w-0 flex-[2] basis-64">
          <Label htmlFor={`${base}-variants`}>Other ways people say it (comma separated)</Label>
          <Input
            id={`${base}-variants`}
            value={variants}
            onChange={(event) => setVariants(event.target.value)}
            placeholder="corner sofa, sectional"
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add term'}
        </Button>
      </div>
      <Status tone={message?.tone ?? 'info'}>{message?.text}</Status>
    </form>
  );
}

/** The synonym list: add a term, edit chips, delete, and export everything as a JSON file. */
export function SynonymEditor({ rows }: { rows: SynonymView[] }) {
  function exportJson() {
    const data = Object.fromEntries(rows.map((row) => [row.term, row.variants]));
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'synonyms.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <AddTerm />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
        <p className="text-base sm:text-sm text-mute">
          {rows.length} {rows.length === 1 ? 'term' : 'terms'}
        </p>
        <Button size="sm" variant="ghost" onClick={exportJson} disabled={rows.length === 0}>
          <Download className="size-4" aria-hidden="true" />
          Export as JSON
        </Button>
      </div>
      {rows.length === 0 ? (
        <p
          className="px-6 py-4 text-base sm:text-sm text-mute">
          No synonyms yet. Add a term above, or import a JSON file.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <SynonymRow key={`${row.id}-${row.variants.join('|')}`} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

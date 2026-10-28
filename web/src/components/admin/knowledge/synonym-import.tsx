'use client';

import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { importSynonymsAction } from '@/app/admin/(panel)/knowledge/actions';
import type { LineError } from '@/lib/admin/knowledge';
import { cn } from '@/lib/cn';
import { ErrorList, Status } from './status';

type Outcome = { tone: 'good'; text: string } | { tone: 'bad'; fileName: string; errors: LineError[] };

/** Import a synonyms JSON file. Terms in the file replace their stored variants. */
export function SynonymImport({ maxBytes }: { maxBytes: number }) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    const fail = (message: string) =>
      setOutcome({ tone: 'bad', fileName: file.name, errors: [{ message }] });
    if (!/\.json$/i.test(file.name)) {
      fail('Choose a .json file.');
      return;
    }
    if (file.size > maxBytes) {
      fail('The file is larger than 1 MB.');
      return;
    }
    setBusy(true);
    setOutcome(null);
    try {
      const result = await importSynonymsAction({ text: await file.text() });
      if (result.ok) {
        const terms = `${result.imported} ${result.imported === 1 ? 'term' : 'terms'}`;
        setOutcome({
          tone: 'good',
          text: `Imported ${terms} from ${file.name}: ${result.created} new, ${result.updated} updated.`,
        });
      } else {
        setOutcome({ tone: 'bad', fileName: file.name, errors: result.errors });
      }
    } catch {
      fail('The file could not be imported. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/20 px-5 py-2.5',
          'text-sm font-semibold hover:border-ink focus-within:border-maroon',
        )}
      >
        <Upload className="size-4" aria-hidden="true" />
        Import a JSON file
        <input
          id={inputId}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <Status>{busy ? 'Importing…' : null}</Status>
      {outcome?.tone === 'good' ? <Status tone="good">{outcome.text}</Status> : null}
      {outcome?.tone === 'bad' ? (
        <ErrorList errors={outcome.errors} title={`${outcome.fileName} cannot be imported yet. Please fix:`} />
      ) : null}
    </div>
  );
}

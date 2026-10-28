'use client';
import { useState } from 'react';
import { parseProductCsv } from '@/lib/catalogue/csv';
import { productCsvTemplate } from '@/lib/catalogue/csv';
import type { CsvParseResult } from '@/lib/catalogue/csv';
import { Button } from '@/components/ui/button';
import { importProductsAction } from '@/app/admin/(panel)/products/actions';

export function CsvImport() {
  const [preview, setPreview] = useState<CsvParseResult | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<Array<{ line: number; ok: boolean; error?: string }>>([]);
  function download() {
    const url = URL.createObjectURL(new Blob([productCsvTemplate()], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'product-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function runImport() {
    if (!preview || preview.errors.length || pending) return;
    setMessage('Importing…');
    setPending(true);
    try {
      const result = await importProductsAction(preview.rows);
      setResults(result.results);
      const failures = result.results.filter((row) => !row.ok).length;
      setMessage(`${result.results.length - failures} imported. ${failures} need attention.`);
    } catch {
      setMessage('The import stopped. Check the product list before retrying these rows.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-5 rounded-[var(--radius-card)] border border-line bg-paper p-5">
      <Button variant="ghost" onClick={download}>Download template</Button>
      <label className="block">
        <span className="mb-2 block font-medium">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          className="min-h-11 w-full min-w-0 text-base file:mr-3 file:min-h-11 file:rounded-xl file:px-4"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setResults([]);
            if (file) void file.text()
              .then((text) => setPreview(parseProductCsv(text)))
              .catch(() => setMessage('The file could not be read. Choose it again.'));
          }}
        />
      </label>
      {preview ? (
        <div aria-live="polite">
          {preview.errors.length ? (
            <>
              <h2 className="font-display text-xl text-bad">Fix {preview.errors.length} row errors</h2>
              <ul>
                {preview.errors.map((error) => (
                  <li key={`${error.line}-${error.messages.join()}`}>
                    Line {error.line}: {error.messages.join('; ')}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl text-good">{preview.rows.length} products ready</h2>
              <p>Photos are fetched only from HTTPS URLs and processed before each row is saved.</p>
              <Button className="mt-4" disabled={pending} onClick={() => void runImport()}>
                {pending ? 'Importing…' : 'Import products'}
              </Button>
            </>
          )}
        </div>
      ) : null}
      <ul className="space-y-2">
        {results.map((row) => (
          <li key={row.line} className="break-words rounded-xl border border-line p-3">
            Line {row.line}: {row.ok ? 'Imported' : row.error || 'Could not import this row. Check it and try again.'}
          </li>
        ))}
      </ul>
      <p className="whitespace-pre-wrap text-base sm:text-sm" aria-live="polite">{message}</p>
    </div>
  );
}

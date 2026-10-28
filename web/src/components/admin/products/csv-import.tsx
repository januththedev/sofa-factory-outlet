'use client';
import { useState } from 'react';
import { parseProductCsv, productCsvTemplate, type CsvParseResult } from '@/lib/catalogue/csv';
import { Button } from '@/components/ui/button';
import { importProductsAction } from '@/app/admin/(panel)/products/actions';

export function CsvImport() {
  const [preview, setPreview] = useState<CsvParseResult | null>(null);
  const [message, setMessage] = useState('');
  function download() {
    const url = URL.createObjectURL(new Blob([productCsvTemplate()], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'product-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function runImport() {
    if (!preview || preview.errors.length) return;
    setMessage('Importing…');
    const result = await importProductsAction(preview.rows);
    const failures = result.results.filter((row) => !row.ok);
    setMessage(failures.length
      ? failures.map((row) => `Line ${row.line}: ${row.error}`).join('\n')
      : `${result.results.length} products imported.`);
  }
  return (
    <div className="space-y-5 rounded-[var(--radius-card)] border border-line bg-paper p-5">
      <Button variant="ghost" onClick={download}>Download template</Button>
      <label className="block">
        <span className="mb-2 block font-medium">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void file.text().then((text) => setPreview(parseProductCsv(text)));
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
              <Button className="mt-4" onClick={() => void runImport()}>Import products</Button>
            </>
          )}
        </div>
      ) : null}
      <p className="whitespace-pre-wrap text-sm" aria-live="polite">{message}</p>
    </div>
  );
}

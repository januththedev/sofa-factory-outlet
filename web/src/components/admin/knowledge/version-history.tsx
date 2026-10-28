'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { rollbackAction } from '@/app/admin/(panel)/knowledge/actions';
import { GoldenRunner } from '@/components/admin/chat/golden-runner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { EvalView } from '@/lib/admin/knowledge';
import { Status } from './status';

export type VersionRowView = {
  id: number;
  version: number;
  isCurrent: boolean;
  source: 'starter' | 'upload';
  savedLabel: string;
  chunkCount: number;
  hasFile: boolean;
};

type Outcome = { tone: 'good' | 'bad'; text: string };

/** Every saved version of a document. Rolling back makes an older version the current one. */
export function VersionHistory({
  slug,
  rows,
  lastEval,
}: {
  slug: string;
  rows: VersionRowView[];
  lastEval: EvalView | null;
}) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function rollBack(row: VersionRowView) {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await rollbackAction({ versionId: row.id });
      if (result.ok) {
        const text =
          result.mode === 'switched'
            ? `Version ${result.version} of ${slug} is the current version again (${result.chunks} chunks).`
            : `Version ${result.restoredFrom} of ${slug} was rebuilt from its stored file and saved as version ` +
              `${result.version} (${result.chunks} chunks). It is the current version now.`;
        setOutcome({ tone: 'good', text });
      } else {
        setOutcome({ tone: 'bad', text: result.error });
      }
    } catch {
      setOutcome({ tone: 'bad', text: 'The roll back did not work. Please try again.' });
    } finally {
      setConfirming(null);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <TR>
            <TH>Version</TH>
            <TH>Saved</TH>
            <TH>Source</TH>
            <TH>Chunks</TH>
            <TH>Original file</TH>
            <TH>
              <span className="sr-only">Action</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              <TD className="font-semibold">Version {row.version}</TD>
              <TD className="whitespace-nowrap">{row.savedLabel}</TD>
              <TD>{row.source === 'starter' ? 'Starter pack' : 'Upload'}</TD>
              <TD>{row.chunkCount}</TD>
              <TD>{row.hasFile ? 'Kept' : <span className="text-mute">Not kept</span>}</TD>
              <TD>
                {row.isCurrent ? (
                  <Badge tone="good">Current</Badge>
                ) : confirming === row.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">Make version {row.version} current?</span>
                    <Button size="sm" onClick={() => rollBack(row)} disabled={busy}>
                      {busy ? 'Rolling back…' : 'Yes, roll back'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(row.id)} disabled={busy}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Roll back to this
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Status tone={outcome?.tone ?? 'info'}>{outcome?.text}</Status>
      {outcome?.tone === 'good' ? (
        <div className="rounded-xl border border-line p-4">
          <p className="mb-3 font-semibold">Did relevance go up or down?</p>
          <GoldenRunner initial={lastEval} />
        </div>
      ) : null}
    </div>
  );
}

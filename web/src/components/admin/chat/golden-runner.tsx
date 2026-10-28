'use client';

import { Minus, Play, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { runGoldenTestAction } from '@/app/admin/(panel)/chat/actions';
import { Status } from '@/components/admin/knowledge/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { EvalView } from '@/lib/admin/knowledge';

/** Plan.md: retrieval hit@3 should be at least 90%. */
const HIT_TARGET = 0.9;

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function Tile({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bone/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {note ? <div className="mt-2 text-sm text-mute">{note}</div> : null}
    </div>
  );
}

function Comparison({ run }: { run: EvalView }) {
  if (run.direction === 'first' || run.changePoints === null) {
    return (
      <p className="text-sm text-mute">This is the first stored run, so there is nothing to compare it with yet.</p>
    );
  }
  const points = Math.abs(run.changePoints).toFixed(1);
  const since = run.previousAtLabel ? ` since the run on ${run.previousAtLabel}` : '';
  if (run.direction === 'same') {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <Minus className="size-4" aria-hidden="true" /> Relevance is unchanged{since}.
      </p>
    );
  }
  const up = run.direction === 'up';
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={`flex items-center gap-2 text-sm font-semibold ${up ? 'text-good' : 'text-bad'}`}>
      <Icon className="size-4" aria-hidden="true" /> Relevance went {up ? 'up' : 'down'} by {points} points{since}.
    </p>
  );
}

/**
 * Runs the golden test set (retrieval only, no model calls) and shows the numbers next to the previous run.
 * Used on the Chat > Golden test tab and as the "run it again" offer after a knowledge change.
 */
export function GoldenRunner({
  initial,
  showFailures = false,
  runLabel,
}: {
  initial: EvalView | null;
  showFailures?: boolean;
  runLabel?: string;
}) {
  const [run, setRun] = useState<EvalView | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await runGoldenTestAction();
      if (response.ok) setRun(response.run);
      else setError(response.error);
    } catch {
      setError('The golden test could not run. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const hitMet = run ? run.hitAt3 >= HIT_TARGET : false;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy} variant={run ? 'ghost' : 'primary'}>
          <Play className="size-4" aria-hidden="true" />
          {busy ? 'Running…' : (runLabel ?? (run ? 'Run the golden test again' : 'Run the golden test'))}
        </Button>
        <p className="text-sm text-mute">Checks retrieval against the saved questions. It never calls the model.</p>
      </div>
      <Status tone="bad">{error}</Status>
      {run ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile
              label="Hit at 3"
              value={percent(run.hitAt3)}
              note={
                <Badge tone={hitMet ? 'good' : 'warn'}>
                  Target {percent(HIT_TARGET)} {hitMet ? 'met' : 'not met yet'}
                </Badge>
              }
            />
            <Tile label="Intent accuracy" value={percent(run.intentAccuracy)} />
            <Tile label="Answered without the model" value={percent(run.answeredWithoutModel)} />
          </div>
          <Comparison run={run} />
          <p className="text-sm text-mute">
            Last run {run.atLabel} on {run.total} questions.
          </p>
          {showFailures ? <Failures run={run} /> : null}
        </div>
      ) : (
        <p className="text-sm text-mute">No golden test has been stored yet.</p>
      )}
    </div>
  );
}

function Failures({ run }: { run: EvalView }) {
  if (run.failures.length === 0) {
    return <p className="text-sm font-semibold text-good">Every question passed.</p>;
  }
  return (
    <div>
      <h3 className="font-semibold">Questions that failed ({run.failures.length})</h3>
      <div className="mt-2">
        <Table>
          <THead>
            <TR>
              <TH>Id</TH>
              <TH>Question</TH>
              <TH>Why it failed</TH>
            </TR>
          </THead>
          <TBody>
            {run.failures.map((failure) => (
              <TR key={failure.id}>
                <TD className="whitespace-nowrap font-mono text-xs">{failure.id}</TD>
                <TD>{failure.question}</TD>
                <TD className="text-mute">{failure.reason}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

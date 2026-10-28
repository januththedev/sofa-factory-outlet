'use client';

import { useId, useState } from 'react';
import { enableEmbeddingsAction, reindexAction } from '@/app/admin/(panel)/knowledge/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/field';
import { Status } from './status';

type Outcome = { tone: 'good' | 'bad'; text: string };

/**
 * Owner-only. Meaning search (embeddings) adds a second ranking next to keyword search. It is switched on once,
 * in month 3, and every document is re-indexed so it gets its embeddings.
 */
export function EmbeddingsCard({
  enabled,
  model,
  dim,
  defaultModel,
  hasKey,
  localDatabase,
}: {
  enabled: boolean;
  model: string | null;
  dim: number | null;
  defaultModel: string | null;
  hasKey: boolean;
  localDatabase: boolean;
}) {
  const modelId = useId();
  const [modelValue, setModelValue] = useState(model ?? defaultModel ?? '');
  const [busy, setBusy] = useState<'enable' | 'reindex' | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function run(kind: 'enable' | 'reindex') {
    setBusy(kind);
    setOutcome(null);
    try {
      const result = kind === 'enable' ? await enableEmbeddingsAction({ model: modelValue }) : await reindexAction();
      setOutcome(result.ok ? { tone: 'good', text: result.message } : { tone: 'bad', text: result.error });
    } catch {
      setOutcome({ tone: 'bad', text: 'That did not work. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Meaning search (embeddings)</CardTitle>
          <p className="mt-1 text-sm text-mute">
            Keyword search is on from day one. Embeddings add a second ranking that understands paraphrases.
          </p>
        </div>
        <Badge tone={enabled ? 'good' : 'neutral'}>{enabled ? 'On' : 'Off'}</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        {enabled ? (
          <p className="text-sm">
            Using <span className="font-mono">{model ?? 'the saved model'}</span>
            {dim ? ` (${dim} dimensions)` : ''}.
          </p>
        ) : null}
        <ul className="list-disc space-y-1 pl-5 text-sm text-mute">
          <li>It needs an OpenRouter key on the server and some OpenRouter credit.</li>
          <li>The database needs the pgvector extension. Neon has it; the local database does not.</li>
          <li>After turning it on, run Re-index once so every document gets its embeddings.</li>
        </ul>
        {!hasKey ? <Status>No OpenRouter key is set on this server yet.</Status> : null}
        {localDatabase ? (
          <Status>This site is using the local database, so embeddings cannot be turned on here.</Status>
        ) : null}
        <div className="max-w-md">
          <Label htmlFor={modelId}>Embedding model</Label>
          <Input
            id={modelId}
            value={modelValue}
            onChange={(event) => setModelValue(event.target.value)}
            placeholder="Model id from OpenRouter"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => run('enable')} disabled={busy !== null}>
            {busy === 'enable' ? 'Turning on…' : 'Turn on embeddings'}
          </Button>
          <Button variant="ghost" onClick={() => run('reindex')} disabled={busy !== null}>
            {busy === 'reindex' ? 'Re-indexing…' : 'Re-index'}
          </Button>
        </div>
        <Status tone={outcome?.tone ?? 'info'}>
          {busy === 'reindex'
            ? 'Re-indexing every document. This can take a minute; keep this page open.'
            : (outcome?.text ?? null)}
        </Status>
      </CardBody>
    </Card>
  );
}

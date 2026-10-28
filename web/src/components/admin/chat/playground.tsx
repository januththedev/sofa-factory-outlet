'use client';

import { Send } from 'lucide-react';
import { useId, useState } from 'react';
import { explainChatAction } from '@/app/admin/(panel)/chat/actions';
import { Status } from '@/components/admin/knowledge/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/field';
import type { ChatExplanation } from '@/lib/chat/explain';

const ANSWERED_BY: Record<ChatExplanation['answeredBy'], string> = {
  faq: 'Instant FAQ',
  template: 'Template',
  model: 'Model',
  handoff: 'Handed to a person',
  fallback: 'Fallback',
};

function noPromptReason(answeredBy: ChatExplanation['answeredBy']): string {
  if (answeredBy === 'faq') return 'No prompt was built: an FAQ answered this instantly, with no model.';
  if (answeredBy === 'template') return 'No prompt was built: a ready-made template answered this, with no model.';
  return 'No prompt was built: nothing relevant was found, so the bot hands over instead of guessing.';
}

function Result({ result }: { result: ChatExplanation }) {
  const extracted = Object.entries(result.extracted).filter(([, value]) => value !== undefined && value !== null);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Answer</CardTitle>
          <Badge tone="maroon">{ANSWERED_BY[result.answeredBy]}</Badge>
        </CardHeader>
        <CardBody>
          <p className="whitespace-pre-wrap">{result.answer}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What it understood</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <p>
            Intent: <Badge tone="neutral">{result.intent}</Badge>
          </p>
          {extracted.length > 0 ? (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
              {extracted.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-mute">{key}</dt>
                  <dd className="font-mono text-xs">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-mute">No details such as size, colour or budget were picked out of the question.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge it found ({result.chunks.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {result.chunks.length === 0 ? (
            <p className="text-sm text-mute">No knowledge chunks matched.</p>
          ) : (
            <ol className="space-y-3">
              {result.chunks.map((chunk, index) => (
                <li key={`${index}-${chunk.headingPath}`} className="rounded-xl border border-line bg-bone/50 p-4">
                  <p
                    className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase
                      tracking-wider text-mute"
                  >
                    <span>{chunk.headingPath}</span>
                    <span>Score {chunk.score.toFixed(3)}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{chunk.body}</p>
                </li>
              ))}
            </ol>
          )}
          {result.products.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-semibold">Products it found ({result.products.length})</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {result.products.map((product) => (
                  <li key={product.id}>
                    {product.name} <span className="text-mute">(score {product.score.toFixed(3)})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>The exact prompt</CardTitle>
        </CardHeader>
        <CardBody>
          {result.prompt ? (
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-ink p-4 text-xs text-bone">
              {result.prompt}
            </pre>
          ) : (
            <p className="text-sm text-mute">{noPromptReason(result.answeredBy)}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Type a question and see what the bot does with it: intent, details picked out, the knowledge it found, the
 * prompt it would send and the answer. Nothing is logged and no visitor is created.
 */
export function Playground() {
  const inputId = useId();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatExplanation | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await explainChatAction({ message });
      if (response.ok) setResult(response.explanation);
      else setError(response.error);
    } catch {
      setError('The chatbot could not answer that just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Playground</CardTitle>
            <p className="mt-1 text-sm text-mute">
              Try a question the way a visitor would type it. Nothing is saved to the conversation log. If a model key
              is set and the bot decides to use the model, this counts as one real model call.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-72">
              <Label htmlFor={inputId}>Question</Label>
              <Input
                id={inputId}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Do you deliver outside Colombo?"
                maxLength={600}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              <Send className="size-4" aria-hidden="true" />
              {busy ? 'Asking…' : 'Ask'}
            </Button>
          </form>
          <div className="mt-4">
            <Status tone="bad">{error}</Status>
            <Status>{busy ? 'Working out an answer…' : null}</Status>
          </div>
        </CardBody>
      </Card>
      {result ? <Result result={result} /> : null}
    </div>
  );
}

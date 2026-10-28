import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { type ConversationDetail as Detail, type MessageRow } from '@/lib/admin/chat';
import { formatWhen } from '@/lib/admin/knowledge';
import { cn } from '@/lib/cn';
import { MessageActions } from './message-actions';

const ANSWERED_BY: Record<NonNullable<MessageRow['answeredBy']>, string> = {
  faq: 'FAQ',
  template: 'Template',
  model: 'Model',
  handoff: 'Handed to a person',
  fallback: 'Fallback',
};

function Retrieved({ message, detail }: { message: MessageRow; detail: Detail }) {
  const retrieved = message.retrieved;
  if (!retrieved) return null;
  const rows: string[] = [];
  if (retrieved.faqId !== undefined) {
    rows.push(`FAQ: ${detail.faqQuestions[retrieved.faqId] ?? `number ${retrieved.faqId} (deleted)`}`);
  }
  for (const chunk of retrieved.chunks ?? []) {
    const title = detail.chunkTitles[chunk.id] ?? `chunk ${chunk.id} (replaced)`;
    rows.push(`Knowledge: ${title} (score ${chunk.score.toFixed(2)})`);
  }
  for (const product of retrieved.products ?? []) {
    const name = detail.productNames[product.id] ?? `product ${product.id}`;
    rows.push(`Product: ${name} (score ${product.score.toFixed(2)})`);
  }
  if (rows.length === 0) return null;
  return (
    <details className="mt-2 text-xs text-mute">
      <summary className="cursor-pointer">What it looked at ({rows.length})</summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </details>
  );
}

function AssistantMeta({ message }: { message: MessageRow }) {
  const facts: string[] = [];
  if (message.confidence !== null) facts.push(`confidence ${Math.round(message.confidence * 100)}%`);
  if (message.model) facts.push(`model ${message.model}`);
  if (message.latencyMs !== null) facts.push(`${message.latencyMs} ms`);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
      {message.intent ? <Badge tone="neutral">Intent: {message.intent}</Badge> : null}
      {message.answeredBy ? <Badge tone="maroon">{ANSWERED_BY[message.answeredBy]}</Badge> : null}
      {message.rating === -1 ? <Badge tone="bad">Thumbs down</Badge> : null}
      {message.rating === 1 ? <Badge tone="good">Thumbs up</Badge> : null}
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </div>
  );
}

/** The visitor message an answer replies to: the nearest one above it. */
function questionBefore(messages: MessageRow[], index: number): string {
  for (let position = index; position >= 0; position -= 1) {
    if (messages[position].role === 'user') return messages[position].text;
  }
  return '';
}

/** One conversation, message by message, with what each answer was based on. */
export function ConversationDetailView({ detail, backHref }: { detail: Detail; backHref: string }) {
  const { conversation, messages } = detail;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            Visitor <span className="font-mono">{conversation.visitorId.slice(0, 8)}</span>
          </CardTitle>
          <p className="mt-1 text-sm text-mute">
            Started {formatWhen(conversation.createdAt)}
            {conversation.context.page ? `, on ${conversation.context.page}` : ''}
          </p>
          {conversation.handoffAt ? (
            <p className="mt-2">
              <Badge tone="warn">Asked for a person on {formatWhen(conversation.handoffAt)}</Badge>
            </p>
          ) : null}
        </div>
        <Link href={backHref} className="text-sm text-maroon underline-offset-4 hover:underline">
          Back to the list
        </Link>
      </CardHeader>
      <CardBody>
        <ol className="space-y-4">
          {messages.map((message, index) => {
            const fromVisitor = message.role === 'user';
            return (
              <li key={message.id} className={cn('flex', fromVisitor ? 'justify-start' : 'justify-end')}>
                <div
                  className={cn(
                    'max-w-[min(40rem,100%)] rounded-2xl px-4 py-3',
                    fromVisitor ? 'bg-bone-2' : 'border border-line bg-paper',
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-mute">
                    {fromVisitor ? 'Visitor' : 'Chatbot'} · {formatWhen(message.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{message.text}</p>
                  {fromVisitor ? null : (
                    <>
                      <AssistantMeta message={message} />
                      <Retrieved message={message} detail={detail} />
                      <MessageActions
                        messageId={message.id}
                        flagged={message.flagged}
                        question={questionBefore(messages, index)}
                      />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {messages.length === 0 ? <p className="text-sm text-mute">This conversation has no messages.</p> : null}
      </CardBody>
    </Card>
  );
}

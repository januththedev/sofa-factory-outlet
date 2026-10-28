'use client';

import { ThumbsDown } from 'lucide-react';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { QuickReply } from '@/lib/chat/api';
import type { ProductCard } from '@/lib/catalogue/queries';
import { DEFAULT_ERROR_TEXT } from './chat-store';
import type { ChatMessage as ChatMessageData } from './chat-store';
import { useChatStore } from './chat-store';
import { talkToAPerson } from './chat-store';
import { ChatProductCards } from './product-cards';
import { QuickReplies } from './quick-replies';

function TypingIndicator() {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-bone-2 px-3.5 py-3"
      aria-label="Assistant is typing"
    >
      <span className="sr-only">Assistant is typing</span>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          aria-hidden
          style={{ animationDelay: `${dot * 0.15}s` }}
          className="h-1.5 w-1.5 rounded-full bg-ink/50 motion-safe:animate-bounce motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function FeedbackRow({ messageId, rating }: { messageId: number; rating?: 1 | -1 }) {
  const rate = useChatStore((state) => state.rate);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void rate(messageId, 1)}
        aria-pressed={rating === 1}
        aria-label="Helpful response"
        className={cn(
          'grid h-11 w-11 place-items-center rounded-full text-mute transition-colors hover:text-maroon',
          rating === 1 && 'bg-bone-2 text-maroon',
        )}
      >
        <ThumbsUp size={18} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => void rate(messageId, -1)}
        aria-pressed={rating === -1}
        aria-label="Not helpful response"
        className={cn(
          'grid h-11 w-11 place-items-center rounded-full text-mute transition-colors hover:text-maroon',
          rating === -1 && 'bg-bone-2 text-maroon',
        )}
      >
        <ThumbsDown size={18} aria-hidden />
      </button>
    </div>
  );
}

function FailedTurn({ message }: { message: ChatMessageData }) {
  const streaming = useChatStore((state) => state.streaming);
  const retry = useChatStore((state) => state.retry);
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-base text-bad"
      role="alert"
    >
      <p>{message.error || DEFAULT_ERROR_TEXT}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={streaming}
          onClick={() => void retry(message.id)}
          className="min-h-11 rounded-full bg-bad px-3 py-2 text-sm font-semibold text-bone
            hover:bg-bad/85 disabled:pointer-events-none disabled:opacity-50"
        >
          Try again
        </button>
        {!message.handoffUrl ? (
          <button
            type="button"
            onClick={() => talkToAPerson(null)}
            className="min-h-11 rounded-full border border-bad/50 px-3 py-2 text-sm font-semibold text-bad
              hover:border-bad hover:bg-bad hover:text-bone"
          >
            Talk to a person
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ChatMessage({
  message,
  showChips = false,
}: {
  message: ChatMessageData;
  showChips?: boolean;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex min-w-0 justify-end">
        <p
          className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-maroon px-3 py-2
            text-base leading-relaxed text-bone [overflow-wrap:anywhere]"
        >
          {message.text}
        </p>
      </div>
    );
  }

  const cards: ProductCard[] = message.cards ?? [];
  const chips: QuickReply[] = message.chips ?? [];
  const noAnswerYet = !message.text && cards.length === 0 && !message.error && !message.handoffUrl;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 justify-start">
        {message.streaming && !message.text ? (
          <TypingIndicator />
        ) : message.text ? (
          <p
            className="max-w-[92%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-bone-2 px-3 py-2
              text-base leading-relaxed text-ink [overflow-wrap:anywhere]"
          >
            {message.text}
          </p>
        ) : null}
      </div>

      {cards.length ? <ChatProductCards cards={cards} /> : null}

      {message.handoffUrl && !message.streaming ? (
        <div className="flex">
          <button
            type="button"
            onClick={() => talkToAPerson(message.handoffUrl ?? null)}
            className="min-h-11 rounded-full bg-maroon px-3 py-2 text-sm font-semibold text-bone
              transition-colors hover:bg-maroon-deep"
          >
            Talk to a person on WhatsApp
          </button>
        </div>
      ) : null}

      {message.error ? (
        <FailedTurn message={message} />
      ) : noAnswerYet && !message.streaming ? (
        <FailedTurn message={{ ...message, error: DEFAULT_ERROR_TEXT }} />
      ) : message.messageId !== undefined && !message.streaming ? (
        <FeedbackRow messageId={message.messageId} rating={message.rating} />
      ) : null}

      {showChips && chips.length ? (
        <QuickReplies
          items={chips}
          cards={cards}
          disabled={message.streaming}
          onSend={(text) => void useChatStore.getState().send(text)}
        />
      ) : null}
    </div>
  );
}

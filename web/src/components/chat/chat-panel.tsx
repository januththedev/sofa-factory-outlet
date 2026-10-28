'use client';

// The chat panel: branded header, `role="log"` message list with the answer
// streaming in, quick replies, the input row and the honest welcome. Loaded on
// demand with next/dynamic (see chat-widget.tsx) and fully keyboard capable:
// Esc closes, focus is trapped while open, focus returns to the button on close.

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { SendHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatStore } from './chat-store';
import { ChatMessage } from './chat-message';

const MAX_LENGTH = 600;
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keep Tab/Shift+Tab cycling inside the panel while it is open. */
function trapFocus(event: React.KeyboardEvent<HTMLDivElement>, root: HTMLElement | null): void {
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !root.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !root.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

export function ChatPanel() {
  const open = useChatStore((state) => state.open);
  const messages = useChatStore((state) => state.messages);
  const askAbout = useChatStore((state) => state.askAbout);
  const streaming = useChatStore((state) => state.streaming);
  const close = useChatStore((state) => state.close);
  const send = useChatStore((state) => state.send);

  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');

  // Focus moves into the panel when it opens; the widget sends it back to the button on close.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Keep the input above the on-screen keyboard: when the visual viewport
  // shrinks (Android resizes-visual mode, iOS), pad the panel by the covered
  // height so the input row rides above it.
  useEffect(() => {
    const view = window.visualViewport;
    const root = rootRef.current;
    if (!view || !root) return;
    const sync = () => {
      const overlap = Math.max(0, window.innerHeight - view.height);
      root.style.paddingBottom = overlap > 1 ? `${Math.round(overlap)}px` : '';
    };
    view.addEventListener('resize', sync);
    view.addEventListener('scroll', sync);
    sync();
    return () => {
      view.removeEventListener('resize', sync);
      view.removeEventListener('scroll', sync);
      root.style.paddingBottom = '';
    };
  }, []);

  // Follow the conversation: jump when a message is added, and while the answer streams.
  // Smoothness comes from `motion-safe:scroll-smooth` on the list itself.
  const lastId = messages.length ? messages[messages.length - 1]?.id : undefined;
  const lastText = messages.length ? (messages[messages.length - 1]?.text ?? '') : '';
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight });
  }, [open, lastId, lastText, messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = '';
    void send(text);
  };

  const onDraftChange = (value: string) => {
    setDraft(value.slice(0, MAX_LENGTH));
    const input = inputRef.current;
    if (input) {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 6.5 * 20)}px`;
    }
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Sofa Factory Outlet assistant"
      inert={!open}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        } else if (event.key === 'Tab') {
          trapFocus(event, rootRef.current);
        }
      }}
      className={cn(
        'fixed inset-0 z-40 flex flex-col bg-bone shadow-2xl',
        'lg:inset-auto lg:bottom-[5.75rem] lg:right-4 lg:h-[36rem] lg:max-h-[calc(100dvh-7.5rem)] lg:w-[26rem] lg:rounded-[var(--radius-card)] lg:border lg:border-line',
        'rounded-t-[var(--radius-card)] lg:rounded-[var(--radius-card)]',
        'motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out',
        open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      <header className="flex items-center gap-3 border-b border-line bg-maroon px-3 pb-[0.6rem] pt-[calc(0.6rem+env(safe-area-inset-top))] text-bone lg:px-4">
        <Image
          src="/brand/mark.png"
          alt=""
          width={144}
          height={144}
          className="h-9 w-9 shrink-0 rounded-full ring-2 ring-bone/40"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[0.95rem] leading-tight">Sofa Factory Outlet assistant</p>
          <p className="text-[0.68rem] leading-tight opacity-75">Automated — the team can step in on WhatsApp</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close chat"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-bone/15"
        >
          <X size={18} aria-hidden />
        </button>
      </header>

      {askAbout ? (
        <div className="bg-clay-soft px-3 py-1.5 text-[0.72rem] text-ink lg:px-4">
          <span className="font-semibold">{askAbout}</span>
        </div>
      ) : null}

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-busy={streaming}
        aria-label="Conversation with the Sofa Factory Outlet assistant"
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 motion-safe:scroll-smooth lg:px-4"
      >
        <div className="flex flex-col gap-2.5">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              showChips={index === messages.length - 1}
            />
          ))}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="border-t border-line px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 lg:px-4"
      >
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="chat-message-input" className="sr-only">
              Message to the Sofa Factory Outlet assistant
            </label>
            <textarea
              id="chat-message-input"
              ref={inputRef}
              value={draft}
              maxLength={MAX_LENGTH}
              rows={1}
              placeholder="Ask about sofas, colours, sizes…"
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              className={cn(
                'w-full resize-none rounded-[var(--radius-card)] border border-line bg-paper px-3 py-2 text-[0.9rem] leading-snug text-ink',
                'placeholder:text-mute focus-visible:outline-maroon',
              )}
            />
            <div className="mt-0.5 text-right text-[0.62rem] text-mute">{draft.length}/{MAX_LENGTH}</div>
          </div>
          <button
            type="submit"
            disabled={!draft.trim() || streaming}
            aria-label="Send message"
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-maroon text-bone transition-colors hover:bg-maroon-deep',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <SendHorizontal size={16} aria-hidden />
          </button>
        </div>
      </form>
    </div>
  );
}

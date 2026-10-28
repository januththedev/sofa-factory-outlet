'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import type { RefObject } from 'react';
import Image from 'next/image';
import { SendHorizontal } from 'lucide-react';
import { X } from 'lucide-react';
import { useModal } from '@/components/site/use-modal';
import { cn } from '@/lib/cn';
import { useChatStore } from './chat-store';
import { ChatMessage } from './chat-message';

const MAX_LENGTH = 600;

/** Lazy phone sheet with a native scrolling log and a keyboard-aware composer. */
export function ChatPanel({ launcherRef }: { launcherRef?: RefObject<HTMLElement | null> }) {
  const open = useChatStore((state) => state.open);
  const messages = useChatStore((state) => state.messages);
  const askAbout = useChatStore((state) => state.askAbout);
  const streaming = useChatStore((state) => state.streaming);
  const close = useChatStore((state) => state.close);
  const send = useChatStore((state) => state.send);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  useModal(open, rootRef, close, launcherRef);

  // The visible viewport includes keyboard occlusion and iOS viewport panning.
  useEffect(() => {
    const view = window.visualViewport;
    const root = rootRef.current;
    if (!open || !view || !root) return;
    const sync = () => {
      root.style.setProperty('--chat-viewport-height', `${Math.round(view.height)}px`);
      root.style.setProperty('--chat-viewport-top', `${Math.round(view.offsetTop)}px`);
    };
    view.addEventListener('resize', sync);
    view.addEventListener('scroll', sync);
    sync();
    return () => {
      view.removeEventListener('resize', sync);
      view.removeEventListener('scroll', sync);
      root.style.removeProperty('--chat-viewport-height');
      root.style.removeProperty('--chat-viewport-top');
    };
  }, [open]);

  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    const list = listRef.current;
    if (open && list) list.scrollTo({ top: list.scrollHeight });
  }, [open, lastMessage, messages.length]);

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
      input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
    }
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal={open ? true : undefined}
      aria-hidden={!open}
      aria-label="Sofa Factory Outlet assistant"
      inert={!open}
      tabIndex={-1}
      data-lenis-prevent
      className={cn(
        'chat-panel fixed inset-x-0 z-[60] flex min-h-0 flex-col overflow-hidden bg-bone shadow-2xl',
        'lg:left-auto lg:right-[calc(1rem+env(safe-area-inset-right))] lg:w-[26rem]',
        'lg:rounded-[var(--radius-card)] lg:border lg:border-line',
        open ? '' : 'hidden',
      )}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b border-line bg-maroon px-3 text-bone
          pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] lg:px-4"
      >
        <Image
          src="/brand/mark.png"
          alt=""
          width={144}
          height={144}
          className="h-9 w-9 shrink-0 rounded-full ring-2 ring-bone/40"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base leading-tight">Sofa Factory Outlet assistant</p>
          <p className="mt-1 text-xs leading-snug opacity-90">Automated — ask for the team on WhatsApp</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close chat"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-bone/15"
        >
          <X size={20} aria-hidden />
        </button>
      </header>

      {askAbout ? (
        <div className="shrink-0 break-words bg-clay-soft px-3 py-2 text-xs text-ink lg:px-4">
          <span className="font-semibold">{askAbout}</span>
        </div>
      ) : null}

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={streaming}
        aria-label="Conversation with the Sofa Factory Outlet assistant"
        className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-3 lg:px-4"
      >
        <div className="flex min-w-0 flex-col gap-3">
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
        className="shrink-0 border-t border-line px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:px-4"
      >
        <label htmlFor="chat-message-input" className="mb-1 block text-xs font-medium">
          Message to the Sofa Factory Outlet assistant
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-message-input"
            ref={inputRef}
            value={draft}
            maxLength={MAX_LENGTH}
            rows={1}
            enterKeyHint="send"
            autoComplete="off"
            placeholder="Ask about sofas, colours, sizes…"
            aria-describedby="chat-message-count"
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2
              text-base leading-snug text-ink placeholder:text-mute focus-visible:outline-maroon"
          />
          <button
            type="submit"
            disabled={!draft.trim() || streaming}
            aria-label="Send message"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-maroon text-bone
              transition-colors hover:bg-maroon-deep disabled:pointer-events-none disabled:opacity-50"
          >
            <SendHorizontal size={20} aria-hidden />
          </button>
        </div>
        <p id="chat-message-count" className="mt-1 text-right text-xs text-mute">{draft.length}/{MAX_LENGTH}</p>
      </form>
    </div>
  );
}

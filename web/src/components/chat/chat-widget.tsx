'use client';

// Mounted once in the site layout. Renders only the floating button; the whole
// panel is a separate client bundle loaded through next/dynamic the first time
// the chat is opened (Plan.md "Chatbot → Lazy loading").

import dynamic from 'next/dynamic';
import { MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { CHAT_OPEN_EVENT, type ChatOpenDetail } from '@/lib/events';
import { useChatStore } from './chat-store';

const ChatPanel = dynamic(() => import('./chat-panel').then((module) => module.ChatPanel), {
  ssr: false,
  // Sits exactly where the floating button is, which is hidden while the chat is open.
  loading: () => (
    <div
      aria-hidden
      className="fixed bottom-[5.5rem] right-3 z-40 h-14 w-14 rounded-full bg-maroon opacity-70 motion-safe:animate-pulse lg:bottom-6 lg:right-4"
    />
  ),
});

/** Floating chat button + lazily loaded panel (integrator mounts it in the site layout). */
export function ChatWidget() {
  const [panelLoaded, setPanelLoaded] = useState(false);
  const open = useChatStore((state) => state.open);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<ChatOpenDetail>).detail ?? {};
      setPanelLoaded(true);
      useChatStore.getState().openPanel(detail);
    };
    window.addEventListener(CHAT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, handleOpen);
  }, []);

  // Stop an in-flight reply if the layout ever unmounts mid-stream (route out of the site shell).
  useEffect(() => () => useChatStore.getState().abort(), []);

  // Restore the saved conversation once per page load, right after hydration.
  useEffect(() => {
    void useChatStore.persist.rehydrate();
  }, []);

  // Keyboard users come back to the button when the panel closes.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  const openNow = () => {
    setPanelLoaded(true);
    useChatStore.getState().openPanel();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openNow}
        aria-label="Open chat assistant"
        aria-haspopup="dialog"
        className={cn(
          'fixed bottom-[5.5rem] right-3 z-40 grid h-14 w-14 place-items-center rounded-full bg-maroon text-bone shadow-lg',
          'transition-colors duration-200 hover:bg-maroon-deep lg:bottom-6 lg:right-4',
          // `hidden` as a class: the attribute loses to Tailwind's display utilities
          open && 'hidden',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-maroon opacity-40 motion-safe:animate-ping motion-reduce:animate-none"
        />
        <MessageCircle size={22} aria-hidden />
      </button>
      {panelLoaded ? <ChatPanel /> : null}
    </>
  );
}

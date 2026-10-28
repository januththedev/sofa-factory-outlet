'use client';

// Mounted once in the site layout. Renders only the floating button; the whole
// panel is a separate client bundle loaded through next/dynamic the first time
// the chat is opened (Plan.md "Chatbot → Lazy loading").

import dynamic from 'next/dynamic';
import { MessageCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { CHAT_OPEN_EVENT } from '@/lib/events';
import type { ChatOpenDetail } from '@/lib/events';
import { configureChatWhatsApp } from './chat-store';
import { useChatStore } from './chat-store';

const ChatPanel = dynamic(() => import('./chat-panel').then((module) => module.ChatPanel), {
  ssr: false,
  // Sits exactly where the floating button is, which is hidden while the chat is open.
  loading: () => (
    <div
      aria-hidden
      className="chat-launcher fixed z-40 h-14 w-14 rounded-full bg-maroon opacity-70"
    />
  ),
});

/** Floating chat button + lazily loaded panel (integrator mounts it in the site layout). */
export function ChatWidget({ whatsapp = null }: { whatsapp?: string | null }) {
  const [panelLoaded, setPanelLoaded] = useState(false);
  const open = useChatStore((state) => state.open);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    configureChatWhatsApp(whatsapp);
    return () => configureChatWhatsApp(null);
  }, [whatsapp]);

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
          'chat-launcher fixed z-40 grid h-14 w-14 place-items-center rounded-full bg-maroon text-bone shadow-lg',
          'transition-colors duration-200 hover:bg-maroon-deep',
          // `hidden` as a class: the attribute loses to Tailwind's display utilities
          open && 'hidden',
        )}
      >
        <MessageCircle size={22} aria-hidden />
      </button>
      {panelLoaded ? <ChatPanel launcherRef={buttonRef} /> : null}
    </>
  );
}

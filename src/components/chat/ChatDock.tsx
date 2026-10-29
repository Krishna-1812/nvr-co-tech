'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { ToolBrief } from '@/lib/marketing/brand';
import { ChatGreeting } from './ChatGreeting';
import { ChatOwl } from './ChatOwl';
import type { ChatDockFull } from './ChatDockFull';

/**
 * The chat in the corner, loaded when somebody reaches for it.
 *
 * The chat itself (ChatDockFull: the panel, the streaming, the markdown, the
 * suggestions) is the largest piece of script on a public page, and almost
 * nobody opens it on their first page. So every page ships only this: the
 * launcher, drawn exactly as the full chat draws it, and three ways of asking
 * for the rest.
 *
 *   - Pointing at the launcher or tabbing to it starts the download, so it is
 *     usually there by the time the click lands.
 *   - Clicking it, pressing ⌘J or Ctrl+J, or anything that dispatches the
 *     `tfi:ask` event loads it and opens it, with the question if one came.
 *   - On a desktop, it also loads by itself once the page has been idle for a
 *     few seconds, so the owl's eyes follow the pointer. On a phone it waits
 *     to be asked.
 *
 * The hello (ChatGreeting) is drawn from here rather than from the full chat,
 * so it reaches phones too without bringing the full chat with it.
 *
 * Either way, none of it competes with the page's own first seconds, which is
 * what a reader and a search engine's measurements are made of.
 */

/** The event the rest of the app opens the chat with. */
export const ASK_EVENT = 'tfi:ask';

/** Open the chat from anywhere, optionally with a question to send. */
export function openChat(question?: string) {
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { question } }));
}

/** Sent whenever the chat opens, by whichever of the two is on the page. */
export const CHAT_OPENED = 'tfi:chat-opened';

/** Set for the visit once the chat has been opened or the hello has been seen. */
export const NUDGED = 'tfi-chat-nudged';

/** What the reader asked for before the full chat had loaded. */
export type ChatStart = { open: boolean; question?: string };

type Props = Omit<Parameters<typeof ChatDockFull>[0], 'start'> & { tools?: readonly ToolBrief[] };

/** Seconds of quiet before a desktop loads the chat by itself. */
const SETTLE_MS = 6000;

export function ChatDock(props: Props) {
  const pathname = usePathname() ?? '/';
  const hidden = pathname === '/ask' || pathname.startsWith('/ask/');
  const [Full, setFull] = useState<ComponentType<Parameters<typeof ChatDockFull>[0]> | null>(null);
  const [start, setStart] = useState<ChatStart | null>(null);

  const load = useCallback(() => {
    void import('./ChatDockFull').then((m) => setFull(() => m.ChatDockFull));
  }, []);

  const ask = useCallback(
    (question?: string) => {
      setStart({ open: true, question });
      window.dispatchEvent(new Event(CHAT_OPENED));
      load();
    },
    [load],
  );

  useEffect(() => {
    if (Full) return;
    const onAsk = (e: Event) => ask((e as CustomEvent<{ question?: string }>).detail?.question);
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'j' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        ask();
      }
    };
    window.addEventListener(ASK_EVENT, onAsk);
    window.addEventListener('keydown', onKey);

    let timer = 0;
    let idle = 0;
    if (window.matchMedia('(min-width: 768px) and (pointer: fine)').matches) {
      timer = window.setTimeout(() => {
        idle = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 4000 }) : window.setTimeout(load, 0);
      }, SETTLE_MS);
    }
    return () => {
      window.removeEventListener(ASK_EVENT, onAsk);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
      if (idle && window.cancelIdleCallback) window.cancelIdleCallback(idle);
    };
  }, [Full, ask, load]);

  if (hidden) return null;

  // The public site only: in the workspace the reader already knows it is there.
  const greet = props.mode === 'visitor' && props.placement === 'site' ? <ChatGreeting open={props.open} tools={props.tools} /> : null;

  if (Full)
    return (
      <>
        {greet}
        <Full {...props} start={start} />
      </>
    );

  // The launcher as the full chat draws it (ChatDockFull, the last button), so
  // nothing moves when that takes over.
  return (
    <>
      {greet}
      <div className="chat" data-chat-skin={props.skin} data-placement={props.placement}>
        <button
          type="button"
          onClick={() => ask()}
          onPointerEnter={load}
          onFocus={load}
          onTouchStart={load}
          className="chat-launcher"
          aria-expanded={false}
          aria-label="Ask a question"
          aria-keyshortcuts="Control+J Meta+J"
        >
          <span className="chat-launcher-glow" aria-hidden />
          <span className="chat-launcher-ring" aria-hidden />
          <span className="chat-launcher-face" aria-hidden>
            <ChatOwl halo={false} mood="idle" />
          </span>
          <ChevronDown className="chat-launcher-close" aria-hidden />
          <span className="chat-launcher-label" aria-hidden>
            Ask anything
          </span>
        </button>
      </div>
    </>
  );
}

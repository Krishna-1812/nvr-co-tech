'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Calculator,
  Check,
  ChevronDown,
  Copy,
  Maximize2,
  RotateCcw,
  Square,
  SquarePen,
  X,
} from 'lucide-react';
import { CHAT_MAX_QUESTION_CHARS, MAX_QUESTION_CHARS } from '@/lib/assist/config';
import { ask, askSite } from '@/lib/assist/stream';
import { suggestionsFor, type Suggestion } from '@/lib/assist/suggestions';
import type { AssistEvent, Source, ToolTrace, TurnNote } from '@/lib/assist/types';
import { visitorSuggestions } from '@/lib/assist/visitor-suggestions';
import type { ToolBrief } from '@/lib/marketing/brand';
import { cn } from '@/lib/utils';
import { ASK_EVENT, type ChatStart } from './ChatDock';
import { ChatMarkdown } from './ChatMarkdown';
import { ChatOwl, type OwlMood } from './ChatOwl';

/**
 * The chat, on every page: a button in the corner with the owl from the logo
 * in it, and a panel that opens from it.
 *
 * One component for both sides of the site, because a reader moving from the
 * public pages into the workspace should meet the same assistant in the same
 * place. What differs is who answers:
 *
 *   visitor  /api/chat, which anybody may use. It is given the whole website
 *            and keeps nothing; the conversation lives in this tab only.
 *   member   /api/assist, the signed-in assistant, which knows the tool on
 *            screen, does its sums with the app's own calculators and saves
 *            each exchange to the reader's history (opened in full at /ask).
 *
 * Kept across navigation by living in the layouts, and across a reload by
 * sessionStorage, which a closed tab clears: a visitor's questions are not
 * written anywhere that outlives the visit (see the privacy policy).
 *
 * Opened by the button, by ⌘J or Ctrl+J, and by anything on the page that
 * dispatches a `tfi:ask` event (the Ask button in the app's top bar does),
 * which may carry a question to send straight away.
 */

type Mode = 'visitor' | 'member';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolTrace[];
  sources?: Source[];
  note?: TurnNote;
  /** Still arriving. */
  pending?: boolean;
};

type Saved = { messages: Msg[]; conversationId: string | null };

const STORE = (mode: Mode) => `tfi-chat-v1-${mode}`;
const NUDGED = 'tfi-chat-nudged';

/** How many messages are kept for a reload. Enough to pick up where you were. */
const KEEP = 40;

/** Words for the wait before the first word of an answer, so it reads as work. */
const WORKING: Record<Mode, string[]> = {
  visitor: ['Reading the website', 'Finding the right page', 'Putting it plainly'],
  member: ['Reading the guides', 'Checking the tools', 'Putting it plainly'],
};

let counter = 0;
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function load(mode: Mode): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORE(mode));
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (!Array.isArray(saved.messages)) return null;
    // An answer that was still arriving when the page went away never will now.
    const messages = saved.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => (m.pending ? { ...m, pending: false, note: m.content ? m.note : ('error' as const), content: m.content || 'That answer was interrupted.' } : m));
    return { messages, conversationId: typeof saved.conversationId === 'string' ? saved.conversationId : null };
  } catch {
    return null;
  }
}

function save(mode: Mode, saved: Saved) {
  try {
    sessionStorage.setItem(STORE(mode), JSON.stringify({ ...saved, messages: saved.messages.slice(-KEEP) }));
  } catch {
    // Private windows and full storage: the chat still works, it just forgets.
  }
}

/**
 * The conversation as the model should see it.
 *
 * Failures and sample answers are the interface talking, not the assistant, so
 * they are left out, and so is the question each of them answered: that
 * question was never really answered, and the reader usually asks it again.
 */
function turnsOf(messages: Msg[]) {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.pending) continue;
    if (m.role === 'assistant') {
      if (m.note || !m.content.trim()) continue;
      out.push({ role: 'assistant', content: m.content });
    } else {
      const next = messages[i + 1];
      if (next?.role === 'assistant' && (next.note || next.pending)) continue;
      out.push({ role: 'user', content: m.content });
    }
  }
  return out;
}

export function ChatDockFull({
  mode,
  skin,
  placement,
  agent = null,
  agentName = null,
  firstName = null,
  open: openTools = [],
  tools = [],
  start = null,
}: {
  mode: Mode;
  /** The public site is always the light desert; the app follows its theme. */
  skin: 'desert' | 'app';
  /** In the app, phones have a dock along the bottom to stand clear of. */
  placement: 'site' | 'app';
  /** Roster slug of the tool on screen (member only). */
  agent?: string | null;
  agentName?: string | null;
  firstName?: string | null;
  /** Slugs anybody may use, for the visitor's suggestions. */
  open?: readonly string[];
  /** The roster, for the visitor's suggestions (content.ts `toolBriefs`). */
  tools?: readonly ToolBrief[];
  /** What brought it in, when that was a reader asking for it before it had loaded (see ChatDock). */
  start?: ChatStart | null;
}) {
  const pathname = usePathname() ?? '/';
  const panelId = useId();
  const titleId = useId();

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  /*
   * Read back from the tab's storage as the first state rather than in an
   * effect. Safe to do during hydration because none of it is drawn until the
   * panel is opened, and the panel always starts closed.
   */
  const [messages, setMessages] = useState<Msg[]>(() =>
    typeof window === 'undefined' ? [] : (load(mode)?.messages ?? []),
  );
  const [conversationId, setConversationId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : (load(mode)?.conversationId ?? null),
  );
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [focused, setFocused] = useState(false);
  const [happy, setHappy] = useState(false);
  const [unread, setUnread] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [working, setWorking] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const launcherOwl = useRef<HTMLSpanElement>(null);
  const abort = useRef<AbortController | null>(null);
  const openRef = useRef(open);
  const stick = useRef(true);
  const closeTimer = useRef(0);
  const startRef = useRef(start);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const limit = mode === 'member' ? MAX_QUESTION_CHARS : CHAT_MAX_QUESTION_CHARS;
  const hidden = pathname === '/ask' || pathname.startsWith('/ask/');

  // ── Keeping the conversation across a reload ──────────────────────────────
  useEffect(() => {
    if (streaming) return;
    save(mode, { messages, conversationId });
  }, [mode, messages, conversationId, streaming]);

  // ── Opening and closing ───────────────────────────────────────────────────
  const close = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setClosing(true);
    closeTimer.current = window.setTimeout(
      () => {
        setOpen(false);
        setClosing(false);
        launcher.current?.focus({ preventScroll: true });
      },
      reduce ? 0 : 190,
    );
  }, []);

  const show = useCallback(() => {
    // Reopened while it was still closing: the close must not land afterwards.
    window.clearTimeout(closeTimer.current);
    openRef.current = true;
    setOpen(true);
    setClosing(false);
    setUnread(false);
    setNudge(false);
    try {
      sessionStorage.setItem(NUDGED, '1');
    } catch {
      // Nothing to remember it in.
    }
  }, []);

  const toggle = useCallback(() => (openRef.current ? close() : show()), [close, show]);

  // Focus the box when the panel opens, where there is a keyboard to type with.
  // On a phone that would raise the keyboard over the suggestions.
  useEffect(() => {
    if (!open || closing) return;
    if (window.matchMedia('(pointer: fine)').matches) {
      const t = window.setTimeout(() => box.current?.focus({ preventScroll: true }), 60);
      return () => window.clearTimeout(t);
    }
  }, [open, closing]);

  // A phone's panel fills the screen, so the page under it should not scroll.
  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 639px)').matches) return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = was;
    };
  }, [open]);

  // ── Talking ───────────────────────────────────────────────────────────────
  const patch = useCallback((id: string, change: (m: Msg) => Msg) => {
    setMessages((all) => all.map((m) => (m.id === id ? change(m) : m)));
  }, []);

  const send = useCallback(
    async (text: string, base?: Msg[]) => {
      const question = text.trim().slice(0, limit);
      if (!question || abort.current) return;

      const user: Msg = { id: uid(), role: 'user', content: question };
      const reply: Msg = { id: uid(), role: 'assistant', content: '', pending: true };
      const before = base ?? messages;
      const turns = [...turnsOf(before), { role: 'user' as const, content: question }];

      setMessages([...before, user, reply]);
      setInput('');
      setStreaming(true);
      setWorking(0);
      setAnnounce('');
      stick.current = true;

      const controller = new AbortController();
      abort.current = controller;

      const events: AsyncGenerator<AssistEvent> =
        mode === 'member'
          ? ask(turns, agent, controller.signal, conversationId)
          : askSite(turns, pathname, controller.signal);

      let answer = '';
      let failed = false;

      try {
        for await (const event of events) {
          switch (event.type) {
            case 'delta':
              answer += event.text;
              patch(reply.id, (m) => ({ ...m, content: m.content + event.text }));
              break;
            case 'tool':
              patch(reply.id, (m) => ({ ...m, tools: [...(m.tools ?? []), event.trace] }));
              break;
            case 'sources':
              patch(reply.id, (m) => ({ ...m, sources: event.sources.filter((s) => s.href).slice(0, 3) }));
              break;
            case 'note':
              patch(reply.id, (m) => ({ ...m, note: event.note }));
              break;
            case 'conversation':
              setConversationId(event.id);
              break;
            case 'error':
              failed = true;
              patch(reply.id, (m) => ({ ...m, content: event.message, note: 'error' }));
              break;
            case 'done':
              break;
          }
        }
      } catch (error) {
        // Stop pressed: what had arrived stays; if nothing had, say so.
        if (!(error instanceof DOMException && error.name === 'AbortError')) failed = true;
        if (!answer) {
          failed = true;
          patch(reply.id, (m) => ({
            ...m,
            content: controller.signal.aborted ? 'Stopped before an answer.' : 'Something went wrong while answering.',
            note: 'error',
          }));
        }
      } finally {
        patch(reply.id, (m) => ({ ...m, pending: false }));
        abort.current = null;
        setStreaming(false);
        if (!failed && answer) {
          setAnnounce(answer);
          setHappy(true);
          window.setTimeout(() => setHappy(false), 1400);
          if (!openRef.current) setUnread(true);
        }
      }
    },
    [agent, conversationId, limit, messages, mode, pathname, patch],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const fresh = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
    setConversationId(null);
    setInput('');
    setAnnounce('');
    try {
      sessionStorage.removeItem(STORE(mode));
    } catch {
      // Nothing stored.
    }
    box.current?.focus({ preventScroll: true });
  }, [mode]);

  const retry = useCallback(
    (failedId: string) => {
      const at = messages.findIndex((m) => m.id === failedId);
      const question = messages[at - 1];
      if (at < 1 || question?.role !== 'user') return;
      void send(question.content, messages.slice(0, at - 1));
    },
    [messages, send],
  );

  const copy = useCallback(async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(m.id);
      window.setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1600);
    } catch {
      // Clipboard refused; nothing useful to say.
    }
  }, []);

  // ── The rest of the page can open it ──────────────────────────────────────
  useEffect(() => {
    const onAsk = (e: Event) => {
      const question = (e as CustomEvent<{ question?: string }>).detail?.question;
      show();
      if (question) void send(question);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'j' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener(ASK_EVENT, onAsk);
    window.addEventListener('keydown', onKey);
    // Asked for before this had loaded (the launcher, ⌘J or an Ask button):
    // carry it out now, once, as if the request had arrived just now.
    const pending = startRef.current;
    startRef.current = null;
    if (pending?.open) queueMicrotask(() => onAsk(new CustomEvent(ASK_EVENT, { detail: { question: pending.question } })));
    return () => {
      window.removeEventListener(ASK_EVENT, onAsk);
      window.removeEventListener('keydown', onKey);
    };
  }, [send, show, toggle]);

  // ── Keeping the newest words in view ──────────────────────────────────────
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    stick.current = near;
    setAtBottom(near);
  };

  const jump = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  // The box grows with what is typed, to a point.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input, open]);

  // Words for the wait, changing while nothing has arrived yet.
  const waiting = streaming && messages.at(-1)?.pending && !messages.at(-1)?.content;
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => setWorking((n) => n + 1), 1500);
    return () => window.clearInterval(t);
  }, [waiting]);

  // ── The owl in the button watches the pointer ─────────────────────────────
  useEffect(() => {
    if (hidden || open) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = launcherOwl.current;
        const b = launcher.current?.getBoundingClientRect();
        if (!el || !b) return;
        const dx = e.clientX - (b.left + b.width / 2);
        const dy = e.clientY - (b.top + b.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        // Nine units of a 34-unit eye: as far as a pupil can go and stay in it.
        const reach = Math.min(9, d / 40);
        el.style.setProperty('--look-x', String(((dx / d) * reach).toFixed(2)));
        el.style.setProperty('--look-y', String(((dy / d) * reach).toFixed(2)));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [hidden, open]);

  // ── A hello, once a visit, for a visitor who has not found it ─────────────
  useEffect(() => {
    if (mode !== 'visitor' || hidden) return;
    if (!window.matchMedia('(min-width: 768px) and (pointer: fine)').matches) return;
    try {
      if (sessionStorage.getItem(NUDGED)) return;
    } catch {
      return;
    }
    const start = window.setTimeout(() => {
      if (openRef.current) return;
      setNudge(true);
      try {
        sessionStorage.setItem(NUDGED, '1');
      } catch {
        // Then it may say hello again next page, which is harmless.
      }
    }, 9000);
    return () => window.clearTimeout(start);
  }, [mode, hidden]);

  useEffect(() => {
    if (!nudge) return;
    const t = window.setTimeout(() => setNudge(false), 9000);
    return () => window.clearTimeout(t);
  }, [nudge]);

  if (hidden) return null;

  const mood: OwlMood = happy
    ? 'happy'
    : waiting
      ? 'thinking'
      : streaming
        ? 'speaking'
        : focused && input
          ? 'listening'
          : 'idle';

  const suggestions: Suggestion[] =
    mode === 'member' ? suggestionsFor(agent).slice(0, 4) : visitorSuggestions(pathname, openTools, tools);

  const empty = messages.length === 0;
  const showPanel = open || closing;
  const left = limit - input.length;
  const ready = input.trim().length > 0 && !streaming;

  return (
    <div className="chat" data-chat-skin={skin} data-placement={placement}>
      {showPanel && (
        <section
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className="chat-panel"
          data-state={closing ? 'closing' : 'open'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          {/* ── The header: a strip of desert with the owl in it ── */}
          <div className="chat-head" data-busy={streaming || undefined}>
            {/* The sun first, so the dunes are drawn over its lower half: it is
                setting behind them, and it brightens while an answer is written. */}
            <span className="chat-sun" aria-hidden />
            <svg className="chat-dunes" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden focusable="false">
              <path d="M0 50 C 70 26 140 30 205 48 S 320 70 400 38 L400 90 L0 90 Z" className="chat-dune-far" />
              <path d="M0 70 C 90 52 160 58 240 70 S 352 82 400 64 L400 90 L0 90 Z" className="chat-dune-near" />
            </svg>

            <span className="chat-head-owl">
              <ChatOwl mood={mood} halo={false} />
            </span>
            <div className="relative min-w-0 flex-1">
              <h2 id={titleId} className="chat-title">
                Ask
              </h2>
              <p className="chat-status">
                <span className="chat-status-dot" aria-hidden />
                {streaming
                  ? 'Writing an answer…'
                  : mode === 'member'
                    ? agentName
                      ? `Knows ${agentName} and every guide`
                      : 'Knows every tool and guide here'
                    : 'Answers from this website'}
              </p>
            </div>

            <div className="relative flex shrink-0 items-center gap-0.5">
              {!empty && (
                <button type="button" onClick={fresh} className="chat-icon-btn" aria-label="Start a new chat" title="New chat">
                  <SquarePen className="size-[17px]" aria-hidden />
                </button>
              )}
              {mode === 'member' && (
                <Link
                  href={conversationId ? `/ask?c=${encodeURIComponent(conversationId)}` : '/ask'}
                  onClick={close}
                  className="chat-icon-btn"
                  aria-label="Open in the full screen"
                  title="Full screen and history"
                >
                  <Maximize2 className="size-[16px]" aria-hidden />
                </Link>
              )}
              <button type="button" onClick={close} className="chat-icon-btn" aria-label="Close the chat" title="Close (Esc)">
                <X className="size-[18px]" aria-hidden />
              </button>
            </div>
          </div>

          {/* ── The conversation ── */}
          <div ref={scroller} onScroll={onScroll} className="chat-body" role="log" aria-live="off" aria-label="Conversation">
            {empty ? (
              <div className="chat-welcome">
                <p className="chat-hello">
                  <span style={{ '--i': 0 } as CSSProperties}>Namaste{firstName ? `, ${firstName}` : ''}.</span>
                </p>
                <p className="chat-intro" style={{ '--i': 1 } as CSSProperties}>
                  {mode === 'member'
                    ? 'Ask about any tool here, the accounting behind it, or a sum you want checked.'
                    : 'Ask me about any tool, guide or policy on this website. I answer from what the site says, and point you to the page.'}
                </p>
                <ul className="chat-suggest" aria-label="Suggested questions">
                  {suggestions.map((s, i) => (
                    <li key={s.label} style={{ '--i': i + 2 } as CSSProperties}>
                      <button type="button" onClick={() => void send(s.question)} disabled={streaming}>
                        <span className="chat-suggest-dot" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{s.label}</span>
                        <ArrowUpRight className="chat-suggest-arrow size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ol className="chat-thread">
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <li key={m.id} className="chat-msg chat-msg-user">
                      <p>{m.content}</p>
                    </li>
                  ) : (
                    <li key={m.id} className="chat-msg chat-msg-bot" data-note={m.note} data-pending={m.pending || undefined}>
                      <span className="chat-avatar" aria-hidden>
                        <ChatOwl halo />
                      </span>
                      <div className="chat-bubble-wrap">
                        {m.note === 'offline' && <p className="chat-badge">Sample answer · no model connected</p>}

                        {m.tools && m.tools.length > 0 && (
                          <ul className="chat-tools" aria-label="Worked out with">
                            {m.tools.map((t, i) => (
                              <li key={i} title={t.summary} data-ok={t.ok || undefined}>
                                <Calculator className="size-3.5" aria-hidden />
                                {t.label}
                                {t.ok && <Check className="size-3.5" aria-hidden />}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="chat-bubble">
                          {m.pending && !m.content ? (
                            <p className="chat-working" aria-label="Writing an answer">
                              <span className="chat-dots" aria-hidden>
                                <i />
                                <i />
                                <i />
                              </span>
                              <span key={working} className="chat-working-word">
                                {WORKING[mode][working % WORKING[mode].length]}
                              </span>
                            </p>
                          ) : (
                            <div className="chat-answer">
                              <ChatMarkdown
                                source={m.content}
                                onNavigate={() => {
                                  if (window.matchMedia('(max-width: 639px)').matches) close();
                                }}
                              />
                              {m.pending && <span className="chat-caret" aria-hidden />}
                            </div>
                          )}
                        </div>

                        {!m.pending && m.note === 'error' && (
                          <button type="button" className="chat-retry" onClick={() => retry(m.id)} disabled={streaming}>
                            <RotateCcw className="size-3.5" aria-hidden />
                            Try again
                          </button>
                        )}

                        {!m.pending && !m.note && m.content && (
                          <div className="chat-after">
                            <button
                              type="button"
                              className="chat-mini-btn"
                              onClick={() => void copy(m)}
                              aria-label={copied === m.id ? 'Copied' : 'Copy the answer'}
                            >
                              {copied === m.id ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                              {copied === m.id ? 'Copied' : 'Copy'}
                            </button>
                            {m.sources?.map((s) => (
                              <Link key={s.id} href={s.href!} className="chat-source" onClick={() => {
                                if (window.matchMedia('(max-width: 639px)').matches) close();
                              }}>
                                {s.title.replace(/^Guide: /, '')}
                                <ArrowUpRight className="size-3" aria-hidden />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ),
                )}
              </ol>
            )}
          </div>

          {!atBottom && !empty && (
            <button type="button" className="chat-jump" onClick={jump} aria-label="Jump to the latest">
              <ArrowDown className="size-4" aria-hidden />
            </button>
          )}

          {/* ── The box ── */}
          <form
            className="chat-foot"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void send(input);
            }}
          >
            <div className="chat-input" data-focused={focused || undefined}>
              <textarea
                ref={box}
                value={input}
                rows={1}
                maxLength={limit}
                placeholder={mode === 'member' ? 'Ask about a tool, a rule or a sum…' : 'Ask about a tool, a guide, your data…'}
                aria-label="Your question"
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  // Not while an IME composition is open: there Enter accepts the word.
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (ready) void send(input);
                  }
                }}
              />
              {streaming ? (
                <button type="button" onClick={stop} className="chat-send" data-stop aria-label="Stop answering">
                  <Square className="size-3.5 fill-current" aria-hidden />
                </button>
              ) : (
                <button type="submit" disabled={!ready} className="chat-send" aria-label="Send">
                  <ArrowUp className="size-[18px]" aria-hidden />
                </button>
              )}
            </div>
            <p className="chat-fine">
              {left < 120 ? (
                <span className={cn(left < 20 && 'text-[var(--c-accent)]')}>{left} characters left</span>
              ) : (
                <>
                  Answers can be wrong, and are not financial advice.{' '}
                  <Link href="/privacy" className="underline decoration-[var(--c-line-2)] underline-offset-2 hover:text-[var(--c-ink)]">
                    Privacy
                  </Link>
                </>
              )}
            </p>
          </form>

          {/* The answer, read once when it is complete, rather than word by word. */}
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
        </section>
      )}

      {nudge && !open && (
        <div className="chat-nudge" role="status">
          <button type="button" className="chat-nudge-text" onClick={show}>
            Questions about a tool or a guide? <strong>Ask me.</strong>
          </button>
          <button type="button" className="chat-nudge-x" onClick={() => setNudge(false)} aria-label="Dismiss">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      <button
        ref={launcher}
        type="button"
        onClick={toggle}
        className="chat-launcher"
        data-open={open || undefined}
        aria-expanded={open}
        aria-controls={showPanel ? panelId : undefined}
        aria-label={open ? 'Close the chat' : 'Ask a question'}
        aria-keyshortcuts="Control+J Meta+J"
      >
        <span className="chat-launcher-glow" aria-hidden />
        <span className="chat-launcher-ring" aria-hidden />
        <span ref={launcherOwl} className="chat-launcher-face" aria-hidden>
          <ChatOwl halo={false} mood={streaming ? 'speaking' : 'idle'} />
        </span>
        <ChevronDown className="chat-launcher-close" aria-hidden />
        {unread && <span className="chat-unread" aria-hidden />}
        <span className="chat-launcher-label" aria-hidden>
          Ask anything
        </span>
      </button>
    </div>
  );
}

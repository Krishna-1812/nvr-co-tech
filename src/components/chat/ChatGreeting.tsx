'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowUp,
  BookOpen,
  Calculator,
  Compass,
  KeyRound,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  X,
  type LucideProps,
} from 'lucide-react';
import { CHAT_MAX_QUESTION_CHARS } from '@/lib/assist/config';
import type { ToolBrief } from '@/lib/marketing/brand';
import { visitorSuggestions } from '@/lib/assist/visitor-suggestions';
import { CHAT_OPENED, NUDGED, openChat } from './ChatDock';

/**
 * The owl says hello: a card over the chat button, once a visit, that greets
 * the reader by the time of day on their own clock and offers four ways in.
 *
 * What it offers follows the page, the way the chat's own suggestions do: on a
 * tool's page, questions about that tool; on a guide, a summary of it; on a
 * calculator, how the sum is done; anywhere else, the three things the site
 * has (tools, calculators, guides) and a person to talk to. Under them is a
 * box to type a question straight into, which hands it to the chat.
 *
 * It waits for the page to be read first (it never arrives in the first few
 * seconds, so it is not part of what a speed test measures), steps aside the
 * moment the chat is opened, goes by itself after a while unless the pointer
 * or the keyboard is on it, and, once closed with the cross, stays away for a
 * few days rather than greeting the same person on every visit.
 */

/** When the cross was last pressed (ms), so a "no thanks" lasts a while. */
const DISMISSED = 'tfi-chat-hello-off';
const QUIET_DAYS = 3;

/** Where it never appears: the sign-in pages, and the full-screen chat. */
const NEVER = ['/login', '/signup', '/forgot-password', '/reset-password', '/onboarding', '/ask'];

type Part = 'morning' | 'afternoon' | 'evening' | 'night';
type Pick = { icon: ComponentType<LucideProps>; label: string } & ({ ask: string } | { href: string });

const HELLO: Record<Part, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Hello, night owl',
};

/** The reader's own clock, not India's: someone abroad is greeted for where they are. */
export function partOf(h: number): Part {
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
}

/** Questions the box cycles through as its placeholder, typed out one by one. */
const EXAMPLES = [
  'What is loading in a flat?',
  'How is GST charged on a new flat?',
  'Pre-EMI or full EMI?',
  'Which tools can I use for free?',
  'Is my data safe here?',
];

const TALK: Pick = { icon: MessageSquare, label: 'Talk to a person', href: '/contact' };
const CALCS: Pick = { icon: Calculator, label: 'Free calculators', href: '/calculators' };
const GUIDES: Pick = { icon: BookOpen, label: 'Plain-English guides', href: '/guides' };
const TOOLS: Pick = { icon: LayoutGrid, label: 'See every tool', href: '/tools' };
const FIND: Pick = { icon: Compass, label: 'Find the right tool', ask: 'Which tools are on this site, and which one fits the work I do?' };

/** What the hello says, and offers, on the page the reader is on. */
export function greetingFor(path: string, open: readonly string[], tools: readonly ToolBrief[]): { line: string; picks: Pick[] } {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const toolPage = /^\/tools\/([a-z0-9-]+)$/.exec(clean)?.[1];
  const tool = tools.find((t) => t.slug === toolPage || (t.href && (clean === t.href || clean.startsWith(`${t.href}/`))));

  let line = 'What are you looking for today? Pick one, or ask me anything about the site.';
  let picks: Pick[] = [FIND, CALCS, GUIDES, TALK];

  if (tool) {
    const [does, access, safe] = visitorSuggestions(clean, open, tools);
    line = `Looking at ${tool.name}? I can tell you what it does, who it is for and how to start.`;
    picks = [
      { icon: Sparkles, label: 'What does it do?', ask: does.question },
      { icon: KeyRound, label: access.label, ask: access.question },
      { icon: ShieldCheck, label: safe.label, ask: safe.question },
      TALK,
    ];
  } else if (clean.startsWith('/guides/')) {
    line = 'Reading a guide? I can sum it up, or point you to what works it out for you.';
    picks = [
      { icon: ListChecks, label: 'Sum this guide up', ask: 'Sum up the guide I am reading in three short lines.' },
      { icon: Compass, label: 'Which tool does this?', ask: 'Which tool on this site works this out for me?' },
      CALCS,
      TALK,
    ];
  } else if (clean.startsWith('/calculators/')) {
    line = 'Checking a sum? I can explain how this one is worked out, step by step.';
    picks = [
      { icon: Sparkles, label: 'Explain this calculator', ask: 'Explain how the calculator I am on works it out, in plain words.' },
      { icon: BookOpen, label: 'Which guide explains it?', ask: 'Which guide on this site explains the calculator I am on?' },
      { icon: Calculator, label: 'More calculators', href: '/calculators' },
      TALK,
    ];
  }

  // Never a way in to the page the reader is already on.
  const elsewhere = (p: Pick) => !('href' in p) || p.href !== clean;
  const here = picks.filter(elsewhere);
  for (const extra of [FIND, GUIDES, CALCS, TOOLS].filter(elsewhere)) if (here.length < 4 && !here.includes(extra)) here.push(extra);
  return { line, picks: here.slice(0, 4) };
}

function quietNow(): boolean {
  try {
    if (sessionStorage.getItem(NUDGED)) return true;
    const off = Number(localStorage.getItem(DISMISSED) || 0);
    return off > 0 && Date.now() - off < QUIET_DAYS * 86_400_000;
  } catch {
    // No storage to remember a "no thanks" in: better silent than nagging.
    return true;
  }
}

function remember(key: string, value: string, store: 'session' | 'local') {
  try {
    (store === 'session' ? sessionStorage : localStorage).setItem(key, value);
  } catch {
    // Nothing to remember it in.
  }
}

/** Night-sky stars: x %, y %, twinkle delay (s). Fixed, so server and client agree. */
const STARS: [number, number, number][] = [
  [8, 22, 0],
  [17, 54, 1.1],
  [29, 14, 0.4],
  [41, 38, 1.8],
  [52, 12, 0.9],
  [60, 46, 0.2],
  [47, 62, 1.4],
  [23, 70, 0.6],
  [35, 30, 2.1],
];

export function ChatGreeting({ open = [], tools = [] }: { open?: readonly string[]; tools?: readonly ToolBrief[] }) {
  const pathname = usePathname() ?? '/';
  const never = NEVER.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Not drawn, then shown, then leaving: 'out' plays the exit before it goes.
  const [state, setState] = useState<'off' | 'in' | 'out'>('off');
  const [part, setPart] = useState<Part>('morning');
  const [when, setWhen] = useState('');
  const [held, setHeld] = useState(false);
  const [text, setText] = useState('');
  /** How long it stays (ms), fixed when it arrives; the line that runs out is drawn from it. */
  const [life, setLife] = useState(0);
  const [hint, setHint] = useState(EXAMPLES[0]);
  const card = useRef<HTMLElement>(null);
  const left = useRef(0);

  const page = useMemo(() => greetingFor(pathname, open, tools), [pathname, open, tools]);

  const leave = useCallback((forGood = false) => {
    if (forGood) remember(DISMISSED, String(Date.now()), 'local');
    // With reduced motion there is no exit animation to wait for.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setState((s) => (s === 'in' ? (still ? 'off' : 'out') : s));
  }, []);

  // ── Arriving: once a visit, after the page has had its first seconds ──────
  useEffect(() => {
    if (never || quietNow()) return;
    const phone = !window.matchMedia('(min-width: 768px) and (pointer: fine)').matches;
    // The opening curtain on a visit's first page covers the screen for a moment.
    const intro = document.documentElement.dataset.intro === 'on' ? 1500 : 0;
    const t = window.setTimeout(
      () => {
        // A hello arriving over an open chat, or one the reader just closed, is noise.
        if (quietNow() || document.querySelector('.chat-panel')) return;
        const now = new Date();
        const day = now.toLocaleDateString('en-IN', { weekday: 'long' });
        const time = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
        setPart(partOf(now.getHours()));
        setWhen(`${day} · ${time}`);
        left.current = phone ? 16_000 : 28_000;
        setLife(left.current);
        setState('in');
        remember(NUDGED, '1', 'session');
      },
      (phone ? 6000 : 3800) + intro,
    );
    return () => window.clearTimeout(t);
  }, [never]);

  // ── Stepping aside when the chat opens, however it was opened ─────────────
  useEffect(() => {
    if (state !== 'in') return;
    const go = () => leave();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && card.current?.contains(document.activeElement)) leave(true);
    };
    window.addEventListener(CHAT_OPENED, go);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(CHAT_OPENED, go);
      window.removeEventListener('keydown', onKey);
    };
  }, [state, leave]);

  // A new page is a new context; the hello belonged to the last one.
  const first = useRef(pathname);
  useEffect(() => {
    if (pathname !== first.current) leave();
  }, [pathname, leave]);

  // ── Going by itself, unless someone is reading it or typing into it ───────
  useEffect(() => {
    if (state !== 'in' || held || text) return;
    const started = Date.now();
    const t = window.setTimeout(() => leave(), left.current);
    return () => {
      window.clearTimeout(t);
      left.current = Math.max(4000, left.current - (Date.now() - started));
    };
  }, [state, held, text, leave]);

  // ── The placeholder types out example questions ───────────────────────────
  useEffect(() => {
    if (state !== 'in' || text) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let n = 0;
    let chars = 0;
    let back = false;
    let t = 0;
    const tick = () => {
      const q = EXAMPLES[n % EXAMPLES.length];
      if (!back) {
        chars++;
        setHint(q.slice(0, chars));
        if (chars >= q.length) back = true;
        t = window.setTimeout(tick, chars >= q.length ? 1800 : 40 + ((chars * 7) % 30));
      } else {
        chars = Math.max(0, chars - 2);
        setHint(q.slice(0, chars));
        if (!chars) {
          back = false;
          n++;
        }
        t = window.setTimeout(tick, chars ? 16 : 280);
      }
    };
    t = window.setTimeout(tick, 1600);
    return () => window.clearTimeout(t);
  }, [state, text]);

  if (never || state === 'off') return null;

  const hello = HELLO[part];
  const words = hello.split(' ');

  return (
    <aside
      ref={card}
      className="chat chat-greet"
      data-chat-skin="desert"
      data-part={part}
      data-state={state}
      data-held={held || text ? '' : undefined}
      aria-labelledby="chat-greet-title"
      style={{ '--greet-ms': `${life}ms` } as CSSProperties}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && state === 'out') setState('off');
      }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div className="chat-greet-head">
        {/* The hour's sky behind the hello: its sun or moon, and the dunes. */}
        <div className="chat-greet-sky" aria-hidden>
          <span className="chat-greet-orb" />
          {part === 'night' && (
            <span className="chat-greet-stars">
              {STARS.map(([x, y, d], i) => (
                <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
              ))}
            </span>
          )}
          <svg className="chat-greet-dunes" viewBox="0 0 360 60" preserveAspectRatio="none" focusable="false">
            <path d="M0 34 C 60 16 130 18 190 32 S 300 50 360 24 L360 60 L0 60 Z" className="chat-greet-dune-far" />
            <path d="M0 48 C 80 34 150 40 220 48 S 320 58 360 44 L360 60 L0 60 Z" className="chat-greet-dune-near" />
          </svg>
        </div>

        <p className="chat-greet-when">{when}</p>
        <h2 id="chat-greet-title" className="chat-greet-title" aria-label={`${hello}.`}>
          {/* Letter by letter, for the way they rise in; read as the label above. */}
          {words.map((word, w) => (
            <span key={w} aria-hidden>
              <span className="chat-greet-word">
                {[...word].map((ch, c) => (
                  <span key={c} className="chat-greet-ch" style={{ '--i': words.slice(0, w).join(' ').length + c + (w ? 1 : 0) } as CSSProperties}>
                    {ch}
                  </span>
                ))}
                {w === words.length - 1 && (
                  <span className="chat-greet-ch chat-greet-dot" style={{ '--i': hello.length } as CSSProperties}>
                    .
                  </span>
                )}
              </span>
              {w < words.length - 1 && ' '}
            </span>
          ))}
        </h2>
      </div>

      <button type="button" className="chat-greet-x" onClick={() => leave(true)} aria-label="Close the greeting" title="Not now">
        <X className="size-4" aria-hidden />
      </button>

      <div className="chat-greet-body">
        <p className="chat-greet-line">{page.line}</p>

        <ul className="chat-greet-picks" aria-label="Ways I can help">
          {page.picks.map((p, i) => {
            const Icon = p.icon;
            const inner = (
              <>
                <span className="chat-greet-icon" aria-hidden>
                  <Icon className="size-[15px]" />
                </span>
                <span className="chat-greet-pick-label">{p.label}</span>
              </>
            );
            return (
              <li key={p.label} style={{ '--i': i } as CSSProperties}>
                {'ask' in p ? (
                  <button type="button" className="chat-greet-pick" onClick={() => openChat(p.ask)}>
                    {inner}
                  </button>
                ) : (
                  <Link href={p.href} className="chat-greet-pick" onClick={() => leave()}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {/* Handed to the chat rather than recorded on the way: what somebody
            types here is a question for the assistant, not a form field. */}
        <form
          className="chat-greet-ask"
          data-private
          onSubmit={(e) => {
            e.preventDefault();
            openChat(text.trim() || undefined);
          }}
        >
          <label htmlFor="chat-greet-q" className="sr-only">
            Ask a question
          </label>
          <input
            id="chat-greet-q"
            className="chat-greet-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX_QUESTION_CHARS))}
            placeholder={hint || ' '}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="chat-greet-send" data-ready={text.trim() ? '' : undefined} aria-label={text.trim() ? 'Ask' : 'Open the chat'}>
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </form>
      </div>

      {/* How long it stays, as a line that runs out; it stops while held. */}
      <span className="chat-greet-timer" aria-hidden />
    </aside>
  );
}

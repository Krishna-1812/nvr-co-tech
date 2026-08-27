'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Building2,
  Coins,
  Globe,
  MessagesSquare,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Choice } from './store';

/**
 * The conversation, beside the grid rather than instead of it.
 *
 * They are one screen because they are two ways of asking the same question, and
 * because the answer to a chat question is very often "now refine that in the
 * filters". A question here can spend a credit; the filters beside it can show
 * what that credit bought.
 *
 * ── What this component is careful about ───────────────────────────────────
 *
 * Rendering somebody else's text. Everything below builds React nodes rather
 * than markup, so there is no escaping to get wrong — and the two things that
 * still need handling are handled explicitly: a withheld surname arrives as
 * asterisks, which the bold pass would otherwise read as markup, and a URL from
 * a web-sourced answer only becomes a link if it is http or https.
 */

export type EnrichChip = {
  type: 'person';
  name: string;
  label?: string;
  title: string;
  domain: string;
  apollo_id: string;
};

export type ChatContext = { org_id: string; name: string; domain: string };

export type Turn = {
  role: 'user' | 'assistant';
  content: string;
  /** Assistant turns only. */
  choices?: Choice[];
  enrich?: EnrichChip[];
  credits?: number;
  researched?: boolean;
  web_search?: boolean;
  pending?: true;
};

// ─── Rendering an answer ─────────────────────────────────────────────────────

/**
 * Only http and https become links.
 *
 * An allowlist rather than a denylist: the alternative is trying to enumerate
 * every scheme that can execute something, and that list is not knowable.
 */
function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`)\]}]+/g;

/** One line's worth of inline formatting: bold runs and links. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  /*
   * Any run of three or more asterisks becomes an ellipsis BEFORE the bold pass.
   * A withheld surname arrives as "Vivek Sh***a", and two of those in one
   * sentence made everything between them bold: "a, Meghana Ka" in bold, which
   * reads as a rendering bug and draws the eye to nothing. The server already
   * abbreviates the ones it produces; this catches asterisks arriving from
   * anywhere else, such as quoted research text.
   */
  const cleaned = text.replace(/\*{3,}/g, '…');

  const out: React.ReactNode[] = [];
  let index = 0;

  for (const part of cleaned.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    index += 1;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      out.push(
        <strong key={`${keyPrefix}-b${index}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>,
      );
      continue;
    }

    // Bare URLs become links; everything else stays text.
    let last = 0;
    for (const match of part.matchAll(URL_IN_TEXT)) {
      const at = match.index ?? 0;
      if (at > last) out.push(part.slice(last, at));

      // Trailing sentence punctuation is not part of the URL.
      let raw = match[0];
      let trail = '';
      while (raw && '.,;:!?'.includes(raw[raw.length - 1])) {
        trail = raw[raw.length - 1] + trail;
        raw = raw.slice(0, -1);
      }

      const href = safeUrl(raw);
      out.push(
        href ? (
          <a
            key={`${keyPrefix}-u${index}-${at}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {raw.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          raw
        ),
      );
      if (trail) out.push(trail);
      last = at + match[0].length;
    }
    if (last < part.length) out.push(part.slice(last));
  }

  return out;
}

/** Paragraphs and bullet lists. Nothing else: an answer is prose, not a document. */
function Answer({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`l${blocks.length}`} className="my-1.5 space-y-1 pl-4">
        {bullets.map((b, i) => (
          <li key={i} className="list-disc text-sm leading-relaxed marker:text-[var(--text-subtle)]">
            {inline(b, `l${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    blocks.push(
      <p key={`p${blocks.length}`} className="text-sm leading-relaxed text-pretty">
        {inline(line, `p${blocks.length}`)}
      </p>,
    );
  }
  flush();

  return <div className="space-y-1.5">{blocks}</div>;
}

// ─── One turn ────────────────────────────────────────────────────────────────

function Provenance({ turn }: { turn: Turn }) {
  const bits: React.ReactNode[] = [];

  if (turn.researched) {
    bits.push(
      <span key="r" className="inline-flex items-center gap-1">
        <Globe className="size-3" aria-hidden />
        {/*
          Both halves, because they are different claims. Researched without a
          live search means the model's own background knowledge, which can be
          years out of date on a question about who holds a role today.
        */}
        {turn.web_search ? 'researched on the live web' : 'researched, no live sources'}
      </span>,
    );
  }
  if (turn.credits) {
    bits.push(
      <span key="c" className="numeric inline-flex items-center gap-1">
        <Coins className="size-3" aria-hidden />
        {turn.credits} {turn.credits === 1 ? 'credit' : 'credits'}
      </span>,
    );
  }

  if (bits.length === 0) return null;
  return <p className="text-subtle mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px]">{bits}</p>;
}

function Bubble({
  turn,
  onPick,
  onReveal,
}: {
  turn: Turn;
  onPick: (choice: Choice) => void;
  onReveal: (chip: EnrichChip) => void;
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="gradient-brand max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-sm leading-relaxed text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]">
          {turn.content}
        </p>
      </div>
    );
  }

  return (
    <div className="surface-lit a-ring rounded-2xl rounded-bl-md px-3.5 py-3">
      {turn.pending ? (
        <p className="text-muted flex items-center gap-2 text-sm">
          <Sparkles className="size-3.5 animate-pulse" aria-hidden />
          Looking that up
        </p>
      ) : (
        <Answer text={turn.content} />
      )}

      {turn.choices && turn.choices.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {turn.choices.map((c) => (
            <button
              key={c.id ?? c.domain}
              type="button"
              onClick={() => onPick(c)}
              className="surface-sunken rounded-lg border px-2.5 py-1.5 text-left text-xs transition hover:border-[var(--border-strong)]"
            >
              <span className="block font-medium">{c.name}</span>
              <span className="text-subtle block">{c.domain || c.hq || 'no domain on file'}</span>
            </button>
          ))}
        </div>
      )}

      {turn.enrich && turn.enrich.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {turn.enrich.map((chip, i) => (
            <button
              key={`${chip.apollo_id || chip.name}-${i}`}
              type="button"
              onClick={() => onReveal(chip)}
              title="Buys the full record for this person. About one credit, and nothing if it is already on file."
              className="surface-sunken inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition hover:border-[var(--border-strong)]"
            >
              <Sparkles className="size-3" aria-hidden />
              {chip.label || chip.name}
            </button>
          ))}
        </div>
      )}

      <Provenance turn={turn} />
    </div>
  );
}

// ─── The panel ───────────────────────────────────────────────────────────────

export function Chat({
  turns,
  busy,
  context,
  onSend,
  onPick,
  onReveal,
  onUnpin,
}: {
  turns: Turn[];
  busy: boolean;
  /** The company follow-up questions are about, until it is cleared. */
  context: ChatContext | null;
  onSend: (text: string) => void;
  onPick: (choice: Choice) => void;
  onReveal: (chip: EnrichChip) => void;
  onUnpin: () => void;
}) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, busy]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText('');
    onSend(trimmed);
  }, [text, busy, onSend]);

  return (
    /*
      `flex-1` so this takes the height its container offers rather than the
      height its own content happens to need. In the drawer that container is a
      full-height panel, and without this the composer settled wherever the
      answers ended and left a few hundred pixels of nothing beneath it. Inside
      the 2xl rail the container is capped rather than fixed, so growing to fill
      and growing to fit are the same thing and this changes nothing there.
    */
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
        {turns.length === 0 ? (
          /*
            Centred rather than parked at the top.

            This panel is as tall as whatever sits beside it, which before the
            first search is a filter panel running the height of the screen. An
            invitation pinned to the top of that leaves two thirds of the panel
            as blank wall and reads as something that failed to load. Capped in
            width for the same reason: at three fifths of a wide screen the
            prompts would otherwise stretch into a single thin line each.
          */
          <div className="flex min-h-full items-center justify-center py-2">
            <div className="surface-sunken a-ring w-full max-w-md rounded-2xl px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <MessagesSquare
                  className="size-4"
                  style={{ color: 'var(--h-violet)' }}
                  aria-hidden
                />
                Ask about a company or a person
              </p>
              <p className="text-muted mt-1.5 text-xs leading-relaxed text-pretty">
                Answers are grounded in what we actually hold, and say plainly when we hold
                nothing. Where our records are silent, the question is still answered from the
                public web, and the answer says which is which.
              </p>
              {/*
                A column, not a wrapped row. These are three whole sentences of
                different lengths, and flowing them beside each other made a
                ragged block that had to be read to be told apart; stacked, each
                one is a line you can aim at.
              */}
              <div className="mt-3 flex flex-col gap-1.5">
                {[
                  'Who is the CMO of Thoughtworks?',
                  'List VPs of Sales at healthcare companies in Texas',
                  'Tell me about Snowflake',
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => onSend(example)}
                    className="surface-lit a-ring text-muted group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
                  >
                    <span className="min-w-0 flex-1">{example}</span>
                    <ArrowUp className="text-subtle size-3 shrink-0 rotate-45" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          turns.map((turn, i) => (
            <Bubble key={i} turn={turn} onPick={onPick} onReveal={onReveal} />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-2.5 shrink-0 space-y-2 border-t pt-2.5">
        {context && (
          /*
            The pinned company, shown rather than implied. A follow-up inherits
            it silently, and an inherited company nobody can see is how an answer
            about the wrong business gets believed.
          */
          <div className="surface-sunken flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs">
            <Building2 className="text-subtle size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Follow-ups are about <span className="font-medium">{context.name}</span>
            </span>
            <button
              type="button"
              onClick={onUnpin}
              aria-label={`Stop asking about ${context.name}`}
              className="text-subtle shrink-0 transition hover:text-[var(--text-c)]"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        )}

        <div className="surface-sunken a-ring flex items-end gap-2 rounded-xl p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            aria-label="Ask a question"
            placeholder="Who runs marketing at Acme?"
            className="min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-relaxed outline-none placeholder:text-[var(--text-subtle)]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            aria-label="Send"
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg transition',
              busy || !text.trim()
                ? 'text-subtle border'
                : 'gradient-brand text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]',
            )}
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, BookOpen, Lock, RotateCcw, Sigma, Sparkles } from 'lucide-react';
import { LogoMark } from '@/components/marketing/Logo';
import { ArchScene } from '@/components/ui/Scene';
import { HeroChip, ToolHero } from '@/components/ui/ToolHero';
import { ask } from '@/lib/assist/stream';
import { suggestionsFor } from '@/lib/assist/suggestions';
import { AGENTS } from '@/lib/marketing/content';
import { ACCENT_VAR } from '@/lib/solutions';
import type { SavedConversation } from '@/lib/assist/history';
import type { Turn } from '@/lib/assist/types';
import { cn } from '@/lib/utils';
import { Composer } from './Composer';
import { History } from './History';
import { Message } from './Message';

/**
 * The conversation itself, used by both the side panel and the full page.
 *
 * One component for the two because they differ in width and in nothing else.
 * A second copy would be a second place for the streaming logic to be subtly
 * wrong, and the streaming logic is the part that is hard to get right.
 */

export function Conversation({
  agent,
  agentName,
  variant,
  initial = null,
}: {
  /** Roster slug of the tool on screen, or null on a screen that is not one. */
  agent: string | null;
  agentName: string | null;
  variant: 'panel' | 'page';
  /** A saved conversation to open on, when the page was asked for one. */
  initial?: SavedConversation | null;
}) {
  const [turns, setTurns] = useState<Turn[]>(initial?.turns ?? []);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);

  /*
   * Which saved conversation this is, once there is one.
   *
   * Null until the first exchange has been written, which the server does and
   * then says so on the stream. Held rather than derived, because it is the one
   * thing that decides whether the next question continues this conversation or
   * starts another, and getting that wrong scatters one thread across several
   * rows in the history.
   */
  const [conversationId, setConversationId] = useState<string | null>(initial?.id ?? null);

  const abort = useRef<AbortController | null>(null);
  // Turns read out of the history are prefixed differently (see turnsFromRows),
  // so a counter that starts at nothing cannot collide with one of them.
  const nextId = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  /*
   * Deltas are buffered and applied on an animation frame.
   *
   * Without this, every token from the model is its own state update and its own
   * render, and each render re-parses the whole answer so far as markdown. On a
   * long reply that is hundreds of parses of a string that keeps growing. The
   * buffer makes it one parse per frame regardless of how fast the tokens
   * arrive, and nobody can see the difference because a frame is a frame.
   */
  const buffered = useRef('');
  const frame = useRef<number | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    const text = buffered.current;
    if (!text) return;
    buffered.current = '';

    setTurns((current) => {
      const last = current[current.length - 1];
      if (!last || last.role !== 'assistant') return current;
      return [...current.slice(0, -1), { ...last, content: last.content + text }];
    });
  }, []);

  // A frame that fires after the component has gone would set state on nothing.
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /*
   * Follow the answer down, but only while the reader is already at the bottom.
   *
   * Scrolling somebody back down while they are reading something further up is
   * the single most irritating thing a chat window does, and it happens every
   * time a long answer is still arriving.
   */
  const stickToBottom = useRef(true);
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  /*
   * Jumped rather than animated, and that is not laziness.
   *
   * A smooth scroll is an animation towards a target, and here the target moves
   * every frame as more of the answer arrives. The animation never catches it,
   * and the scroll events it emits on the way look exactly like the reader
   * scrolling up, which switches the following-along off. The first version of
   * this did that and simply sat at the top of a long answer.
   *
   * Setting the position outright cannot be chased or cancelled, and because it
   * lands at the bottom, the scroll event it causes re-confirms that we are
   * still at the bottom rather than contradicting it.
   */
  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || streaming) return;

      const asked: Turn = { id: `q${nextId.current++}`, role: 'user', content: text };
      const answer: Turn = { id: `a${nextId.current++}`, role: 'assistant', content: '' };

      // The history sent is what was on screen before this question, plus the
      // question. The empty assistant turn is a placeholder for the interface
      // and has no business being sent to the model.
      const history = [
        ...turns
          .filter((t) => t.note !== 'error')
          .map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: text },
      ];

      setTurns((current) => [...current, asked, answer]);
      setDraft('');
      setStreaming(true);
      stickToBottom.current = true;

      const controller = new AbortController();
      abort.current = controller;

      /** Everything except the streamed text, which goes through the buffer. */
      const patch = (changes: Partial<Turn>) =>
        setTurns((current) =>
          current.map((turn) => (turn.id === answer.id ? { ...turn, ...changes } : turn)),
        );

      try {
        for await (const event of ask(history, agent, controller.signal, conversationId)) {
          switch (event.type) {
            case 'sources':
              patch({ sources: event.sources });
              break;

            // Where this exchange was filed. On the first question it is the
            // conversation being created, and from then on it is the same id
            // coming back, so setting it every time costs nothing.
            case 'conversation':
              setConversationId(event.id);
              break;

            case 'note':
              patch({ note: event.note });
              break;

            case 'tool':
              // Flushed first so a calculation cannot appear above text that was
              // written before it.
              flush();
              setTurns((current) =>
                current.map((turn) =>
                  turn.id === answer.id
                    ? { ...turn, tools: [...(turn.tools ?? []), event.trace] }
                    : turn,
                ),
              );
              break;

            case 'delta':
              buffered.current += event.text;
              if (frame.current === null) frame.current = requestAnimationFrame(flush);
              break;

            case 'error':
              flush();
              // The failure replaces the empty answer rather than being appended
              // to it, so there is never a half-sentence above an error.
              setTurns((current) =>
                current.map((turn) =>
                  turn.id === answer.id
                    ? { ...turn, role: 'assistant', content: event.message, note: 'error' }
                    : turn,
                ),
              );
              break;

            case 'done':
              flush();
              break;
          }
        }
      } finally {
        if (frame.current !== null) {
          cancelAnimationFrame(frame.current);
          frame.current = null;
        }
        flush();
        setStreaming(false);
        abort.current = null;

        // A question stopped before a single word arrived would otherwise leave
        // an empty bubble with nothing in it and no explanation.
        setTurns((current) =>
          current.map((turn) =>
            turn.id === answer.id && !turn.content
              ? { ...turn, content: 'That answer was stopped.', note: 'error' }
              : turn,
          ),
        );
      }
    },
    [agent, conversationId, flush, streaming, turns],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  /**
   * A clean sheet.
   *
   * The conversation that was on screen is not thrown away, it is left where it
   * was saved, and dropping the id here is what makes the next question the
   * start of a new one rather than a continuation of the last.
   */
  const reset = useCallback(() => {
    abort.current?.abort();
    setTurns([]);
    setDraft('');
    setConversationId(null);
  }, []);

  /** Open one from the history, in place, wherever this is being rendered. */
  const resume = useCallback((conversation: SavedConversation) => {
    abort.current?.abort();
    setTurns(conversation.turns);
    setConversationId(conversation.id);
    setDraft('');
    // Opened at the end, where the conversation was left, not at the beginning.
    stickToBottom.current = true;
  }, []);

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          variant === 'panel' ? 'px-4 py-4' : 'px-1 py-6',
        )}
      >
        {/* Wider while empty on the page, so the opening hero has room for its
            arch; the conversation itself keeps a reading measure. */}
        <div
          className={cn(
            'mx-auto space-y-6',
            variant === 'page' && (empty ? 'max-w-5xl' : 'max-w-3xl'),
          )}
        >
          {empty ? (
            <Opening agent={agent} agentName={agentName} variant={variant} onPick={send} />
          ) : (
            turns.map((turn, i) => (
              <Message key={turn.id} turn={turn} streaming={streaming && i === turns.length - 1} />
            ))
          )}
        </div>
      </div>

      <div
        className={cn(
          'shrink-0 border-t bg-[var(--surface)]/60 backdrop-blur-sm',
          variant === 'panel' ? 'px-4 py-3' : 'px-1 py-4',
        )}
      >
        <div className={cn('mx-auto', variant === 'page' && 'max-w-3xl')}>
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => send(draft)}
            onStop={stop}
            streaming={streaming}
            autoFocus={variant === 'page'}
            placeholder={
              agentName ? `Ask about ${agentName}, or about the accounting` : 'Ask a question'
            }
          />

          <div className="text-subtle mt-2 flex items-center gap-3 text-[11px]">
            <p className="min-w-0 flex-1">
              Answers can be wrong. Figures come from this app&rsquo;s own calculators, but check
              anything you are going to file.
            </p>

            {/*
              Offered even on an empty screen, which is exactly when somebody is
              most likely to want it: the reason to open the assistant with
              nothing on screen is often to find what you asked it last time.
            */}
            <History current={conversationId} onOpen={resume} />

            {!empty && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex shrink-0 items-center gap-1.5 transition hover:text-[var(--text-c)]"
              >
                <RotateCcw className="size-3" aria-hidden />
                Start again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
/**
 * What is on screen before anybody types.
 *
 * Four questions rather than a description of the assistant, because a
 * description is read once and a question can be pressed. They are chosen to
 * draw the edges of what it does: see lib/assist/suggestions.
 *
 * Two shapes for the two places it is shown. On the full page it is the
 * screen's one signature moment, in the frame every tool opens with: the
 * question as the headline, the house owl on its books in the arch beside it,
 * and the four questions as the working under it. In the side panel, which is
 * thirty rems wide and sits over somebody's work, the same questions stand on
 * their own under a smaller heading, because an arch there would be a picture
 * of a hero rather than one.
 */
function Opening({
  agent,
  agentName,
  variant,
  onPick,
}: {
  agent: string | null;
  agentName: string | null;
  variant: 'panel' | 'page';
  onPick: (question: string) => void;
}) {
  const suggestions = suggestionsFor(agent);
  const here = agent ? AGENTS.find((a) => a.slug === agent) : undefined;
  const tone = here ? ACCENT_VAR[here.accent] : 'var(--color-brand-500)';
  const title = agentName ? `Ask about ${agentName}` : 'Ask about anything here';
  const sub =
    'How the tools work, and the accounting behind them. It does the arithmetic with the same code the rest of the app uses, and it says where each answer came from.';

  const picks = (
    <div
      className={cn('grid gap-2.5 text-left', variant === 'page' ? 'mt-8 sm:grid-cols-2' : 'mt-3')}
    >
      {suggestions.map((suggestion, i) => (
        <Suggestion
          key={suggestion.label}
          index={i}
          label={suggestion.label}
          question={suggestion.question}
          tone={tone}
          onPick={() => onPick(suggestion.question)}
        />
      ))}
    </div>
  );

  if (variant === 'page') {
    return (
      <ToolHero
        id="ask-opening"
        label="Ask · the assistant"
        pill={{
          icon: Sparkles,
          text: agentName ? `Answering about ${agentName}` : 'Across every tool',
          tone,
        }}
        title={title}
        sub={sub}
        glow={tone}
        scene={<ArchScene motif="owl" className="h-full min-h-[18rem]" />}
      >
        {picks}

        {/* What it promises, each of which the answer screen then shows:
            the working under the answer, the documents under that, and a
            history nobody else can read (migration 0009). */}
        <div className="mt-6 flex flex-wrap gap-2">
          <HeroChip icon={Sigma}>Sums done by the app&rsquo;s own calculators</HeroChip>
          <HeroChip icon={BookOpen}>Sources under every answer</HeroChip>
          <HeroChip icon={Lock}>Your history is yours alone</HeroChip>
        </div>
      </ToolHero>
    );
  }

  return (
    <div className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] px-1 py-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="surface-sunken a-inner relative grid size-11 shrink-0 place-items-center rounded-2xl border"
        >
          <span
            className="absolute inset-0 -z-10 m-auto size-20 rounded-full opacity-25 blur-2xl"
            style={{ background: `radial-gradient(circle, ${tone}, transparent 70%)` }}
          />
          <LogoMark id="assist-opening" className="size-7" />
        </span>
        <div className="min-w-0">
          <h2 className="m-display text-[1.35rem] leading-tight">{title}</h2>
          <p className="text-muted mt-1.5 text-[13px] leading-relaxed text-pretty">{sub}</p>
        </div>
      </div>

      <p className="a-label mt-6">Start with</p>
      {picks}
    </div>
  );
}

/**
 * One of the opening questions, as something to press.
 *
 * The short label is the thing being chosen, so it is set in the weight; the
 * full question is underneath because that is what will actually be sent, and
 * pressing something without seeing what it says is a small act of faith this
 * screen has no reason to ask for. Numbered so the four read as a set.
 */
function Suggestion({
  index,
  label,
  question,
  tone,
  onPick,
}: {
  index: number;
  label: string;
  question: string;
  tone: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{ '--tone': tone } as CSSProperties}
      className="surface-lit a-ring a-lift group relative flex min-w-0 items-start gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />
      <span
        aria-hidden
        className="tinted grid size-8 shrink-0 place-items-center rounded-xl border text-[11px] font-semibold tabular-nums"
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-[13.5px] font-semibold tracking-tight">
          {label}
          <ArrowUpRight
            className="text-subtle size-3.5 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--text-c)]"
            aria-hidden
          />
        </span>
        <span className="text-subtle mt-1 line-clamp-2 block text-[12px] leading-relaxed">
          {question}
        </span>
      </span>
    </button>
  );
}

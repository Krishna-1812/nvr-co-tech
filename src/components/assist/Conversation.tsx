'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { LogoMark } from '@/components/marketing/Logo';
import { ask } from '@/lib/assist/stream';
import { suggestionsFor } from '@/lib/assist/suggestions';
import { AGENTS } from '@/lib/marketing/content';
import { ACCENT_VAR } from '@/lib/solutions';
import type { Turn } from '@/lib/assist/types';
import { cn } from '@/lib/utils';
import { Composer } from './Composer';
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
}: {
  /** Roster slug of the tool on screen, or null on a screen that is not one. */
  agent: string | null;
  agentName: string | null;
  variant: 'panel' | 'page';
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);

  const abort = useRef<AbortController | null>(null);
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
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

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
        for await (const event of ask(history, agent, controller.signal)) {
          switch (event.type) {
            case 'sources':
              patch({ sources: event.sources });
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
    [agent, flush, streaming, turns],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setTurns([]);
    setDraft('');
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
        <div className={cn('mx-auto space-y-5', variant === 'page' && 'max-w-3xl')}>
          {empty ? (
            <Opening agent={agent} agentName={agentName} onPick={send} />
          ) : (
            turns.map((turn, i) => (
              <Message
                key={turn.id}
                turn={turn}
                streaming={streaming && i === turns.length - 1}
              />
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
 */
function Opening({
  agent,
  agentName,
  onPick,
}: {
  agent: string | null;
  agentName: string | null;
  onPick: (question: string) => void;
}) {
  const suggestions = suggestionsFor(agent);
  const here = agent ? AGENTS.find((a) => a.slug === agent) : undefined;
  const tone = here ? ACCENT_VAR[here.accent] : 'var(--color-brand-500)';

  return (
    <div className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] px-1 py-6 text-center">
      <div className="relative mx-auto w-fit">
        <span
          aria-hidden
          className="absolute inset-0 -z-10 m-auto size-24 rounded-full opacity-25 blur-2xl"
          style={{ background: `radial-gradient(circle, ${tone}, transparent 70%)` }}
        />
        <LogoMark id="assist-opening" tile className="elev-2 size-11 rounded-2xl" />
      </div>

      <h2 className="m-display mt-5 text-[clamp(1.25rem,2.4vw,1.6rem)]">
        {agentName ? `Ask about ${agentName}` : 'Ask about anything here'}
      </h2>
      <p className="text-muted mx-auto mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-pretty">
        How the tools work, and the accounting behind them. It does the arithmetic with the same
        code the rest of the app uses, and it says where each answer came from.
      </p>

      <div className="mt-7 grid gap-2 text-left sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onPick(suggestion.question)}
            className="surface-lit a-lift group rounded-xl px-3.5 py-3 text-left"
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: tone }} />
              {suggestion.label}
            </span>
            <span className="text-subtle mt-1 block line-clamp-2 text-[11.5px] leading-relaxed">
              {suggestion.question}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

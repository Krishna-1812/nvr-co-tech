'use client';

import { AlertCircle, FlaskConical } from 'lucide-react';
import { LogoMark } from '@/components/marketing/Logo';
import type { Turn } from '@/lib/assist/types';
import { cn } from '@/lib/utils';
import { Markdown } from './Markdown';
import { Sources } from './Sources';
import { Workings } from './Workings';

/**
 * One turn.
 *
 * The two sides are shaped differently rather than just aligned differently. A
 * question is a short tinted card that stops well before the edge, because it is
 * a thing the reader said and should read as quoted back. An answer runs the
 * full width with no card around it at all, because it is the content of the
 * screen and boxing it would make an eight-paragraph reply look like a
 * notification.
 *
 * Under the answer, in order: the arithmetic, then the documents. That order is
 * deliberate. The working is part of the answer and the sources are a footnote
 * about where it came from.
 */

/**
 * The mark beside an answer.
 *
 * The platform's own logo rather than a robot or a pair of sparkles. What is
 * speaking is this application, and the two chevrons are what it is called
 * everywhere else on screen. A sample answer gets a plain tile instead, so the
 * difference is visible at a glance and not only in the label.
 */
function Mark({ sample }: { sample: boolean }) {
  if (sample) {
    return (
      <span
        aria-hidden
        className="surface-sunken text-subtle a-ring mt-0.5 grid size-7 shrink-0 place-items-center rounded-xl border"
      >
        <FlaskConical className="size-3.5" />
      </span>
    );
  }

  return <LogoMark id="assist-mark" className="elev-1 mt-0.5 size-7 shrink-0 rounded-xl" />;
}

export function Message({ turn, streaming = false }: { turn: Turn; streaming?: boolean }) {
  // Plays once, on the turn's first mount. Its id never changes across the
  // re-renders a streaming reply causes, so this never replays mid-answer.
  const enter = 'animate-[rise_0.4s_cubic-bezier(0.22,1,0.36,1)_backwards]';

  if (turn.role === 'user') {
    return (
      <div className={cn('flex justify-end', enter)}>
        <div className="surface-lit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
          {turn.content}
        </div>
      </div>
    );
  }

  if (turn.note === 'error') {
    return (
      <div
        role="alert"
        className={cn(
          'tinted flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-[13.5px] leading-relaxed',
          enter,
        )}
        style={{ '--tone': 'var(--status-rejected)' } as React.CSSProperties}
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="min-w-0">{turn.content}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', enter)}>
      <Mark sample={turn.note === 'offline'} />

      <div className="min-w-0 flex-1">
        {turn.note === 'offline' && (
          <p className="a-label mb-2 inline-flex items-center gap-1.5">
            <FlaskConical className="size-3" aria-hidden />
            Sample, not the model
          </p>
        )}

        {/* Calculations are shown as they happen, above the words, because they
            arrive first and an empty gap while one runs looks like a stall. */}
        <Workings traces={turn.tools ?? []} />

        {turn.content ? (
          <Markdown source={turn.content} />
        ) : (
          streaming && <Thinking />
        )}

        {/* Only once the answer is finished. A row of chips appearing under a
            half-written sentence pulls the eye off the sentence. */}
        {!streaming && <Sources sources={turn.sources ?? []} />}
      </div>
    </div>
  );
}

/**
 * The gap before the first word.
 *
 * Three dots rather than a spinner: a spinner says "loading", which is what the
 * page does, and this is something composing a reply. The stagger is the same
 * one the rest of the app uses for arriving lists.
 */
function Thinking() {
  return (
    <p className="flex items-center gap-1.5 py-1.5" aria-label="Working on it">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-[var(--text-subtle)]"
          style={{ animation: `blip 1.4s ease-in-out ${i * 0.16}s infinite` }}
        />
      ))}
    </p>
  );
}

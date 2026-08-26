'use client';

import { useState } from 'react';
import { CornerDownLeft, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Say it in a sentence, and watch it become filters.
 *
 * The whole value of this control is that it **spends nothing**. Nothing is
 * fetched, nobody is looked up, and what the sentence became is sitting in the
 * panel to be read, corrected and only then run. That is why it fills the
 * filters instead of running the search: a parser that searched on your behalf
 * would be a parser you had to pay to disagree with.
 */

export type FillOutcome = {
  /** Controls the sentence set, named as the panel names them. */
  set: string[];
  /** Values the sentence carried that this tab has no control for. */
  ignored: string[];
  /** Present only when the parser read a company name as a different spelling. */
  readAs: { typed: string; as: string } | null;
  /** Nothing in the sentence was usable as a filter. */
  unclear: boolean;
  error?: string;
};

export function AskBar({
  onFill,
  busy,
  outcome,
  onDismiss,
}: {
  onFill: (text: string) => void;
  busy: boolean;
  outcome: FillOutcome | null;
  onDismiss: () => void;
}) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed && !busy) onFill(trimmed);
  };

  return (
    <div className="space-y-2">
      <div className="surface-sunken a-ring flex items-start gap-2 rounded-xl p-2">
        <Wand2 className="text-subtle mt-1.5 ml-1 size-4 shrink-0" aria-hidden />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line: this is one sentence,
            // not a document, and the common case should not need the mouse.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          aria-label="Describe what you are looking for"
          placeholder="Heads of marketing at healthcare companies in Texas with 200 to 500 people"
          className="min-w-0 flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed outline-none placeholder:text-[var(--text-subtle)]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim()}
          title="Reads your sentence into the filters below. Costs nothing and searches nothing."
          className={cn(
            'mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition',
            busy || !text.trim()
              ? 'text-subtle border'
              : 'gradient-brand text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]',
          )}
        >
          {busy ? (
            <>
              <Sparkles className="size-3.5 animate-pulse" aria-hidden />
              Reading
            </>
          ) : (
            <>
              <CornerDownLeft className="size-3.5" aria-hidden />
              Fill
            </>
          )}
        </button>
      </div>

      {outcome && (
        <div
          className="a-ring rounded-xl border px-2.5 py-2 text-xs leading-relaxed"
          style={{
            background: outcome.error
              ? 'color-mix(in oklab, var(--h-rose) 8%, var(--surface-raised))'
              : 'color-mix(in oklab, var(--h-cyan) 7%, var(--surface-raised))',
          }}
        >
          {outcome.error ? (
            <p>{outcome.error}</p>
          ) : outcome.unclear ? (
            <p>
              Nothing in that could be turned into a filter. A role, an industry, a company or a
              size is usually what does it.
            </p>
          ) : (
            <>
              <p>
                Set <span className="font-semibold">{outcome.set.join(', ')}</span>. Nothing has
                been searched yet, so change anything below before you run it.
              </p>
              {outcome.readAs && (
                /*
                  Said out loud, because a silently corrected name is how a
                  search answers confidently about somebody else's company.
                */
                <p className="mt-1">
                  Read <span className="font-semibold">{outcome.readAs.typed}</span> as{' '}
                  <span className="font-semibold">{outcome.readAs.as}</span>.
                </p>
              )}
              {outcome.ignored.length > 0 && (
                <p className="mt-1">
                  This tab has no control for {outcome.ignored.join(', ')}, so{' '}
                  {outcome.ignored.length === 1 ? 'it was' : 'they were'} left out rather than
                  applied where you could not see {outcome.ignored.length === 1 ? 'it' : 'them'}.
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-subtle mt-1.5 hover:text-[var(--text-c)]"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

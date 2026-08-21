'use client';

import { useEffect, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { MAX_QUESTION_CHARS } from '@/lib/assist/config';
import { cn } from '@/lib/utils';

/**
 * The box you type in.
 *
 * A textarea rather than an input, because half the questions worth asking here
 * have a ledger extract or a list of amounts pasted into them, and an input
 * turns that into one unreadable line. It grows with the content and stops at a
 * height that still leaves the conversation visible, which is the whole reason
 * to cap it.
 *
 * Enter sends and Shift+Enter starts a line. That is the convention every chat
 * window has settled on, and going against it costs a message sent half-written
 * every time somebody forgets.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);

  /*
   * Grow to fit, up to a point.
   *
   * The height has to be reset to auto before it is read: scrollHeight is the
   * content height or the current height, whichever is larger, so without the
   * reset a textarea that has grown can never shrink again when text is deleted.
   */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const ready = value.trim().length > 0 && !streaming;

  return (
    <div
      className={cn(
        'surface-lit a-ring relative rounded-2xl transition',
        'focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/12',
      )}
    >
      <textarea
        ref={box}
        value={value}
        autoFocus={autoFocus}
        rows={1}
        maxLength={MAX_QUESTION_CHARS}
        placeholder={placeholder}
        aria-label="Ask a question"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Not while a composition is open: on an IME, Enter is how you accept
          // the candidate, and sending there would post half a word.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (ready) onSend();
          }
        }}
        className="max-h-42 w-full resize-none bg-transparent py-3 pr-13 pl-3.5 text-base lg:text-[14px] leading-relaxed outline-none placeholder:text-[var(--text-subtle)]"
      />

      {/* Anchored to the bottom of the box rather than centred, so it stays put
          as the textarea grows underneath it. */}
      <div className="absolute right-2 bottom-2">
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop answering"
            className="surface text-muted grid size-9 place-items-center rounded-xl border transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)] active:scale-95"
          >
            <Square className="size-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!ready}
            aria-label="Send"
            className={cn(
              'grid size-9 place-items-center rounded-xl transition active:scale-95',
              ready
                ? 'gradient-brand elev-brand text-white hover:brightness-110'
                : 'surface-sunken text-subtle border',
            )}
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import { openChat } from './ChatDock';
import { ChatOwl } from './ChatOwl';

/**
 * The Ask button in the workspace's top bar.
 *
 * It used to open a sheet of its own down the right of the screen; now it
 * opens the chat in the corner, so there is one assistant on every screen and
 * it is the same one whichever way you reach it (this button, the owl in the
 * corner, or ⌘J).
 */
export function AskButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openChat()}
      aria-label="Ask the assistant"
      aria-keyshortcuts="Control+J Meta+J"
      title="Ask (⌘J)"
      className={cn(
        'group relative flex h-9 shrink-0 items-center gap-2 rounded-xl border px-2 transition',
        'border-[var(--border-c)] bg-[var(--surface-sunken)] text-[var(--text-muted)]',
        'hover:border-[var(--border-strong)] hover:text-[var(--text-c)]',
        className,
      )}
    >
      <span className="block size-6 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
        <ChatOwl />
      </span>
      <span className="hidden pr-0.5 text-[13px] font-medium sm:block">Ask</span>
    </button>
  );
}

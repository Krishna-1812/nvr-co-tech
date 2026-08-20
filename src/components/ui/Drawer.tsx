'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The two panel shapes the analytics section opens records in.
 *
 * Both are Radix dialogs for the same reason the existing Modal is: focus
 * trapping, Escape, scroll lock and the aria wiring are genuinely fiddly and
 * getting any one of them wrong makes a panel that traps a keyboard user. What
 * differs here is shape and, more importantly, scrolling.
 *
 * `Drawer` slides in from the right and is the default: a person's journey, a
 * drill-down list, one page's viewers. `WideModal` is centred and much wider,
 * and exists for one surface only — the full person profile, which pairs two
 * dense columns side by side and simply cannot be read in a 460px column.
 *
 * The scroll rule is the thing to preserve if either is ever rewritten: the
 * header stays put and exactly one region inside scrolls. A panel where the
 * whole body scrolls as one takes the close button off screen the moment the
 * content is long, which is precisely when somebody most wants to shut it.
 */

export function Drawer({
  open,
  onClose,
  title,
  /** Rendered into the fixed header, under the title. Usually the chip row. */
  header,
  children,
  /** Widen for content that needs it. The default suits a timeline. */
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  header?: ReactNode;
  children: ReactNode;
  width?: 'md' | 'lg';
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-[fade_0.18s_ease-out] fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px]" />
        <Dialog.Content
          className={cn(
            'elev-4 animate-[sheet-in_0.24s_cubic-bezier(0.22,1,0.36,1)] fixed inset-y-0 right-0 z-50',
            'flex w-[calc(100vw-1.5rem)] flex-col border-l bg-[var(--surface-raised)]',
            width === 'md' ? 'sm:w-[460px]' : 'sm:w-[620px]',
          )}
        >
          <header className="shrink-0 border-b px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-[15px] leading-tight font-semibold tracking-tight">
                {title}
              </Dialog.Title>
              <Dialog.Close
                className="text-muted -m-1 rounded-lg p-1 transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </div>
            {header}
          </header>

          {/* The one scrolling region. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The profile surface. Centred, roughly 1180px, capped at 92% of the viewport.
 *
 * Deliberately not a drawer. Everything else in this section is one column of
 * one person's history, which a side panel suits. This one sets third-party
 * enrichment against first-party activity and is meant to be compared across
 * the middle, so it needs the width and it needs to be the thing you are
 * looking at rather than something parked beside the page.
 */
export function WideModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** For screen readers. The visible identity is built by the caller's hero band. */
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-[fade_0.18s_ease-out] fixed inset-0 z-50 bg-black/55 backdrop-blur-[3px]" />
        <Dialog.Content
          className="elev-4 animate-[pop_0.2s_cubic-bezier(0.34,1.56,0.64,1)] fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1180px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-[var(--surface-raised)]"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>

          {/* Floating rather than in a header band: the hero below runs edge to
              edge, and a full-width header bar above it would cost 60px of
              vertical space on a panel that is already fighting for it. */}
          <Dialog.Close
            className="text-muted absolute top-4 right-4 z-20 grid size-8 place-items-center rounded-lg border bg-[var(--surface-raised)]/80 backdrop-blur transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Dialog.Close>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

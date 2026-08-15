'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { Maximize2, Sparkles, X } from 'lucide-react';
import { AGENTS } from '@/lib/marketing/content';
import { ACCENT_VAR } from '@/lib/solutions';
import { cn } from '@/lib/utils';
import { Conversation } from './Conversation';

/**
 * The assistant, wherever you happen to be.
 *
 * A panel over the screen rather than a page you navigate to, because nearly
 * every question worth asking it is a question about the thing currently in
 * front of you. Sending somebody away from a half-filled voucher to ask what a
 * field means is how a help feature goes unused.
 *
 * It knows which tool it was opened from and says so, and the same slug pins
 * that tool's documents to the top of what the model is given. So "why can I not
 * approve this" is answered about approvals rather than about approvals in
 * general.
 *
 * ⌘J to open, to match ⌘K for the palette. Closing the panel still clears what
 * is on screen, because a sheet that reopens mid-thought is a sheet you have to
 * clear before you can ask something else. What has changed is that the
 * conversation is no longer gone with it: each exchange is written as it lands,
 * and the History control at the foot of the panel opens any of them back up
 * here without leaving the page. See migration 0009 for what is kept, what is
 * not, and who can read it.
 */
export function AssistPanel({
  agent,
  agentName,
}: {
  /** Roster slug of the tool this was opened from, or null on the hub. */
  agent: string | null;
  agentName: string | null;
}) {
  const [open, setOpen] = useState(false);

  // The panel is tinted by the tool it was opened from, when there is one, so
  // the claim in the subtitle below ("Answering about X") is also something you
  // can see rather than only read.
  const here = agent ? AGENTS.find((a) => a.slug === agent) : undefined;
  const tone = here ? ACCENT_VAR[here.accent] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((was) => !was);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Ask the assistant"
          className={cn(
            'group relative flex h-9 shrink-0 items-center gap-2 rounded-xl border px-2.5 transition',
            'border-[var(--border-c)] bg-[var(--surface-sunken)] text-[var(--text-muted)]',
            'hover:border-[var(--border-strong)] hover:text-[var(--text-c)]',
          )}
        >
          <Sparkles
            className="size-4 shrink-0 transition-transform group-hover:scale-110"
            style={{ color: tone ?? 'var(--color-brand-500)' }}
            aria-hidden
          />
          <span className="hidden text-[13px] font-medium sm:block">Ask</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="animate-[fade_0.18s_ease-out] fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />

        {/*
          A sheet down the right rather than a centred modal. It is a column of
          conversation, and a column belongs against an edge; a centred box the
          same height would leave two margins doing nothing.

          onOpenAutoFocus is left alone so Radix focuses the panel, and the
          composer takes focus itself only on the full page, where typing is the
          entire purpose of the screen.
        */}
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'a-ring elev-4 fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-[var(--surface)] sm:max-w-[30rem]',
            'animate-[sheet-in_0.28s_cubic-bezier(0.22,1,0.36,1)]',
          )}
        >
          <span
            aria-hidden
            className={cn('h-[3px] shrink-0', !tone && 'gradient-brand')}
            style={tone ? { backgroundImage: `linear-gradient(135deg, ${tone}, var(--color-accent-500))` } : undefined}
          />

          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-[14px] font-semibold tracking-tight">
                Ask
              </Dialog.Title>
              <p className="text-subtle mt-0.5 truncate text-[11px]">
                {agentName ? `Answering about ${agentName}` : 'Across every tool here'}
              </p>
            </div>

            <Link
              href="/ask"
              onClick={() => setOpen(false)}
              aria-label="Open in the full screen"
              title="Open in the full screen"
              className="text-subtle grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
            >
              <Maximize2 className="size-4" aria-hidden />
            </Link>

            <Dialog.Close
              aria-label="Close"
              className="text-subtle grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>

          <Conversation agent={agent} agentName={agentName} variant="panel" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

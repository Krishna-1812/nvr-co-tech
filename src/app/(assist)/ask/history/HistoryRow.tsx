'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ArrowRight, MessagesSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { removeConversation } from '@/app/actions/assist';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';

/**
 * One saved conversation in the list.
 *
 * The whole card is the link and the delete control is layered above it, the
 * same arrangement the reconciliation history uses, for the same reason: the
 * common action should be the whole target and the destructive one should be a
 * small thing you have to aim at.
 *
 * Opening it goes to /ask rather than to a page of its own. A conversation is
 * not a document to be inspected, it is one you are in the middle of, and the
 * useful thing to do with an old one is nearly always to ask it something else.
 */
export function HistoryRow({
  id,
  title,
  when,
  turnCount,
  agentName,
  tone,
}: {
  id: string;
  title: string;
  when: string;
  turnCount: number;
  /** The tool it was begun inside, if it was begun inside one. */
  agentName: string | null;
  /** That tool's accent, for the tile and the chip. */
  tone?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const outcome = await removeConversation(id);
      if (outcome.ok) {
        toast.success('Deleted.');
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(outcome.error);
      }
    });
  };

  return (
    <div
      style={{ '--tone': tone ?? 'var(--color-brand-500)' } as CSSProperties}
      className="surface-lit a-ring a-lift group relative overflow-hidden rounded-2xl"
    >
      <Link
        href={`/ask?c=${id}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none"
      >
        <span className="sr-only">Open {title}</span>
      </Link>

      <div className="flex items-center gap-3.5 p-4 sm:gap-4 sm:p-5">
        {/* Tinted by the tool it was begun inside, the same accent the hub
            gives that tool, and plain brand when it was begun nowhere. */}
        <span
          aria-hidden
          className="tinted a-inner hidden size-10 shrink-0 place-items-center rounded-xl border min-[380px]:grid"
        >
          <MessagesSquare className="size-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-tight" title={title}>
            {title}
          </p>
          <p className="text-subtle mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span>{when}</span>
            <span aria-hidden className="opacity-50">
              ·
            </span>
            <span>
              <span className="numeric font-semibold text-[var(--text-c)]">{turnCount}</span>{' '}
              {turnCount === 1 ? 'turn' : 'turns'}
            </span>
            {agentName && (
              <span className="tinted inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold">
                <span className="sr-only">About </span>
                {agentName}
              </span>
            )}
          </p>
        </div>

        <div className="relative z-20 flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${title}`}
            className="text-subtle grid size-8 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
          <ArrowRight
            className="text-subtle size-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          />
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this conversation?"
        description="The questions and the answers go for good. Nothing else on the platform changes: the assistant never had access to your records in the first place."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={remove} loading={busy}>
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

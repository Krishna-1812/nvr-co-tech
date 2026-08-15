'use client';

import { useCallback, useState, useTransition } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowUpRight, Check, History as HistoryIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchConversations, openConversation } from '@/app/actions/assist';
import {
  whenLabel,
  type ConversationSummary,
  type SavedConversation,
} from '@/lib/assist/history';
import { cn } from '@/lib/utils';

/**
 * Conversations you have had, from wherever you are having one.
 *
 * A menu rather than a screen, because the panel is already a sheet over the
 * page and sending somebody to a third place to find last Tuesday's question
 * defeats the point of the panel. Choosing one loads it where you are standing:
 * in the sheet if you are in the sheet, on the page if you are on the page.
 *
 * The list is fetched when the menu opens and not before. It is a query nobody
 * has asked for until they reach for it, and the assistant should not cost a
 * round trip on every screen that shows the Ask button.
 */
export function History({
  current,
  onOpen,
}: {
  /** The conversation on screen, if it is a saved one. Marked in the list. */
  current: string | null;
  onOpen: (conversation: SavedConversation) => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(() => {
    // Fetched afresh each time it is opened. A menu that showed the list as it
    // stood ten minutes ago would be missing the conversation you just had.
    startLoading(async () => {
      const outcome = await fetchConversations();
      setConversations(outcome.ok ? outcome.data : []);
      setProblem(outcome.ok ? null : outcome.error);
    });
  }, []);

  const open = async (id: string) => {
    setOpening(id);
    const outcome = await openConversation(id);
    setOpening(null);

    if (outcome.ok) onOpen(outcome.data);
    else toast.error(outcome.error);
  };

  return (
    <DropdownMenu.Root onOpenChange={(open) => open && load()}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 transition hover:text-[var(--text-c)]"
        >
          <HistoryIcon className="size-3" aria-hidden />
          History
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="top"
          sideOffset={8}
          className="surface elev-4 animate-[pop_0.15s_ease-out] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl p-1.5"
        >
          <p className="text-subtle px-2.5 pt-1 pb-2 text-[10px] font-semibold tracking-wide uppercase">
            Your conversations
          </p>

          {conversations === null || loading ? (
            <p className="text-subtle flex items-center gap-2 px-2.5 py-3 text-[13px]">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Looking them up
            </p>
          ) : problem ? (
            <p className="text-subtle px-2.5 py-3 text-[13px] leading-relaxed">{problem}</p>
          ) : conversations.length === 0 ? (
            <p className="text-subtle px-2.5 py-3 text-[13px] leading-relaxed">
              Nothing saved yet. A conversation is kept once it has an answer in it, and only you
              can see it.
            </p>
          ) : (
            <ul className="max-h-[19rem] overflow-y-auto">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <DropdownMenu.Item
                    onSelect={(event) => {
                      // Held open while the conversation loads, so the menu does
                      // not vanish and leave nothing happening on screen.
                      event.preventDefault();
                      void open(conversation.id);
                    }}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 outline-none',
                      'data-[highlighted]:bg-[var(--surface-sunken)]',
                    )}
                  >
                    <span className="grid size-4 shrink-0 place-items-center pt-0.5">
                      {opening === conversation.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : conversation.id === current ? (
                        <Check className="size-3.5 text-brand-600 dark:text-brand-300" aria-hidden />
                      ) : null}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{conversation.title}</span>
                      <span className="text-subtle mt-0.5 block text-[11px]">
                        {whenLabel(conversation.updatedAt)}
                        {' · '}
                        {conversation.turnCount} {conversation.turnCount === 1 ? 'turn' : 'turns'}
                      </span>
                    </span>
                  </DropdownMenu.Item>
                </li>
              ))}
            </ul>
          )}

          <DropdownMenu.Item asChild>
            <Link
              href="/ask/history"
              className="text-subtle mt-1 flex cursor-pointer items-center gap-1.5 rounded-lg border-t px-2.5 py-2.5 text-[12px] outline-none data-[highlighted]:text-[var(--text-c)]"
            >
              <ArrowUpRight className="size-3.5" aria-hidden />
              Manage and delete
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

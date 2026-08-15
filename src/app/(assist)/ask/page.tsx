import type { Metadata } from 'next';
import { Conversation } from '@/components/assist/Conversation';
import { readConversation } from '@/lib/assist/store';
import { AGENTS } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Ask',
  description: 'Questions about the tools here, and about the accounting behind them.',
};

/**
 * The assistant, full screen.
 *
 * No PageHeader. Every other screen in the app opens with one, and this is the
 * one place it would be wrong: the conversation has its own opening state, and a
 * title above it would push the box you type in further down a screen whose
 * whole job is that box.
 *
 * `?c=` opens a saved conversation. It is read here, on the server, rather than
 * fetched after the page mounts, so a link to a conversation arrives with the
 * conversation in it instead of with an empty panel that fills in a moment
 * later. A missing or someone else's id is simply not found, and the page opens
 * on the usual blank screen rather than on an error: there is nothing useful to
 * say about a conversation that is not there.
 *
 * `agent` is null on a new conversation on purpose. The panel is opened from
 * inside a tool and knows which one; this page is opened from a rail and does
 * not, so nothing is pinned and the question alone decides what is retrieved.
 * A resumed conversation is the exception, and keeps whatever it was begun
 * inside: a follow-up three days later is still about the same tool.
 */
export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const initial = c ? await readConversation(c) : null;
  const agent = initial?.agent ?? null;
  const agentName = agent ? (AGENTS.find((a) => a.slug === agent)?.name ?? null) : null;

  return (
    /*
     * A definite height, because the conversation is a column that scrolls
     * inside itself rather than a page that grows. The subtraction is the
     * chrome above and below it: the 4rem top bar, plus this main element's own
     * padding, which is larger on a phone to clear the dock.
     */
    <div className="flex h-[calc(100dvh-12.5rem)] min-h-[26rem] flex-col lg:h-[calc(100dvh-9.5rem)]">
      <Conversation
        agent={agent}
        agentName={agentName}
        variant="page"
        initial={initial}
        // Remounts when a different conversation is asked for, so opening one
        // from the history page replaces what is on screen rather than being
        // ignored as a new initial value for state that already exists.
        key={initial?.id ?? 'new'}
      />
    </div>
  );
}

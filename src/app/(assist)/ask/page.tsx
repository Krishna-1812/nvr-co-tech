import type { Metadata } from 'next';
import { Conversation } from '@/components/assist/Conversation';

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
 * `agent` is null here on purpose. The panel is opened from inside a tool and
 * knows which one; this page is opened from a rail and does not, so nothing is
 * pinned and the question alone decides what is retrieved. Guessing a tool here
 * would answer "how do I start" about whichever one happened to be first.
 */
export default function AskPage() {
  return (
    /*
     * A definite height, because the conversation is a column that scrolls
     * inside itself rather than a page that grows. The subtraction is the
     * chrome above and below it: the 4rem top bar, plus this main element's own
     * padding, which is larger on a phone to clear the dock.
     */
    <div className="flex h-[calc(100dvh-12.5rem)] min-h-[26rem] flex-col lg:h-[calc(100dvh-9.5rem)]">
      <Conversation agent={null} agentName={null} variant="page" />
    </div>
  );
}

'use client';

import type { Thread } from '@/lib/analytics/activity';
import { ThreadList } from './Chats';
import { useDrill } from './Drill';

/** The newest chats on the Admin screen; each opens in the panel to read in full. */
export function ThreadCard({ threads, now }: { threads: Thread[]; now: number }) {
  const { open } = useDrill();
  return (
    <div className="p-3">
      <ThreadList threads={threads} now={now} onOpen={(key) => open({ t: 'thread', key })} />
    </div>
  );
}

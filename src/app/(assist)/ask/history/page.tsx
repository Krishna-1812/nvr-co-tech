import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, MessagesSquare, Sparkles } from 'lucide-react';
import { NO_HISTORY_TABLE, whenLabel } from '@/lib/assist/history';
import { listConversations } from '@/lib/assist/store';
import { AGENTS } from '@/lib/marketing/content';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, EmptyState, buttonClass } from '@/components/ui/primitives';
import { ClearAll } from './ClearAll';
import { HistoryRow } from './HistoryRow';

export const metadata: Metadata = { title: 'Conversation history' };

/**
 * Everything you have asked the assistant.
 *
 * Yours only, and that is enforced by migration 0009 rather than by this query.
 * A conversation has no second reader: unlike a voucher, which passes through
 * other people's hands, there is no approver branch and no admin branch in the
 * policy, so this list cannot be made to show somebody else's questions.
 *
 * The list renders from the conversation rows alone. Not one turn is read to
 * draw it, which is why the title is cut from the first question on the way in
 * rather than worked out on the way out.
 */
export default async function AskHistoryPage() {
  const conversations = await listConversations(100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Ask"
        title="History"
        description="Conversations are kept as they were on screen, and only you can see them. Nothing here expires on its own."
        action={
          conversations && conversations.length > 0 ? (
            <ClearAll count={conversations.length} />
          ) : undefined
        }
      />

      {!conversations ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Database className="size-6" />}
              title="History is not switched on yet"
              description={`${NO_HISTORY_TABLE} The tables that keep saved conversations have not been created in this project. Apply migration 0009 and they will start appearing here.`}
              action={
                <Link href="/ask" className={buttonClass({ variant: 'primary' })}>
                  <Sparkles className="size-4" aria-hidden />
                  Ask something
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : conversations.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<MessagesSquare className="size-6" />}
              title="Nothing here yet"
              description="A conversation is saved once it has a question and an answer in it. Ask something and it will be waiting here afterwards."
              action={
                <Link href="/ask" className={buttonClass({ variant: 'primary' })}>
                  <Sparkles className="size-4" aria-hidden />
                  Ask something
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="stagger space-y-3">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <HistoryRow
                id={conversation.id}
                title={conversation.title}
                when={whenLabel(conversation.updatedAt)}
                turnCount={conversation.turnCount}
                agentName={
                  AGENTS.find((agent) => agent.slug === conversation.agent)?.name ?? null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

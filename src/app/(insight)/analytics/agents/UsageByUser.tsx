'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { Drawer } from '@/components/ui/Drawer';
import { number, NUM } from '@/components/analytics/Figures';
import { Avatar, PersonCell, Roster, RosterHead, RosterRow, RosterTd, RosterTh, WhenCell } from '@/components/analytics/People';
import { accentFor } from '@/lib/analytics/identity';
import { cn } from '@/lib/utils';

/**
 * Who has used which tool, against the allowance.
 *
 * The drawer here is deliberately the plainest in the section: no timeline, no
 * history, just counts and bars. That is not an omission — this system cannot
 * see inside a run. It knows a tool was opened and by whom, and nothing about
 * what happened next, so a timeline of opens would imply a level of detail that
 * does not exist. The page says as much in its own description rather than
 * letting the reader assume otherwise.
 */

export type ToolUse = {
  slug: string;
  name: string;
  used: number;
  cap: number;
};

export type ToolUser = {
  email: string;
  name: string | null;
  photo: string | null;
  total: number;
  lastRun: string;
  tools: ToolUse[];
  atCap: boolean;
};

export function UsageByUser({
  users,
  cap,
  now,
}: {
  users: ToolUser[];
  cap: number;
  now: number;
}) {
  const [open, setOpen] = useState<ToolUser | null>(null);

  return (
    <>
      <Card className="overflow-hidden">
        <CardTitle
          title="By person"
          description="Most opens first. Click anyone for their breakdown per tool."
        />

        {users.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="No tool has been opened yet"
            description="A run is recorded when a reconciliation is saved or the assistant answers a question. Nothing is recorded for simply opening a page, so this stays empty until somebody actually uses something."
          />
        ) : (
          <div className="px-5 py-3">
            <Roster className="min-w-[40rem]">
              <RosterHead>
                <RosterTh>Person</RosterTh>
                <RosterTh>Tools used</RosterTh>
                <RosterTh align="right">Total opens</RosterTh>
                <RosterTh>Last opened</RosterTh>
              </RosterHead>
              <tbody>
                {users.map((user, i) => (
                  <RosterRow
                    key={user.email}
                    email={user.email}
                    index={i}
                    onClick={() => setOpen(user)}
                  >
                    <RosterTd>
                      <PersonCell
                        email={user.email}
                        name={user.name}
                        photo={user.photo}
                        lastSeen={user.lastRun}
                        now={now}
                      />
                    </RosterTd>
                    <RosterTd>
                      <span className="flex flex-wrap gap-1">
                        {user.tools.map((tool) => (
                          <ToolPill key={tool.slug} tool={tool} />
                        ))}
                      </span>
                    </RosterTd>
                    <RosterTd align="right">
                      <span className={cn(NUM, 'text-[12.5px] font-semibold')}>
                        {number(user.total)}
                      </span>
                    </RosterTd>
                    <RosterTd>
                      <WhenCell iso={user.lastRun} now={now} />
                    </RosterTd>
                  </RosterRow>
                ))}
              </tbody>
            </Roster>
          </div>
        )}
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? (open.name ?? open.email) : ''}
        header={
          open && (
            <div className="mt-3 flex items-center gap-3">
              <Avatar
                email={open.email}
                name={open.name}
                photo={open.photo}
                lastSeen={open.lastRun}
                now={now}
                size={44}
              />
              <span className={cn(NUM, 'text-subtle text-[11.5px]')}>{open.email}</span>
            </div>
          )
        }
      >
        {open && (
          <>
            <ul className="space-y-3">
              {open.tools.map((tool) => {
                const past = tool.used > tool.cap;
                const share = Math.min(1, tool.used / tool.cap);

                return (
                  <li key={tool.slug}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] font-medium">{tool.name}</span>
                      <span
                        className={cn(
                          NUM,
                          'text-[12px] font-semibold',
                          past && 'text-[var(--h-rose)]',
                        )}
                      >
                        {number(tool.used)} / {number(tool.cap)}
                      </span>
                    </div>
                    <span className="a-track mt-1.5 block h-1.5 overflow-hidden rounded-full">
                      <span
                        className="a-fill block h-full rounded-full"
                        style={{
                          width: `${share * 100}%`,
                          background: past
                            ? 'linear-gradient(90deg, color-mix(in oklab, var(--h-rose) 55%, transparent), var(--h-rose))'
                            : `linear-gradient(90deg, color-mix(in oklab, ${accentFor(tool.slug)} 55%, transparent), ${accentFor(tool.slug)})`,
                        }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="text-subtle mt-5 text-[11.5px] leading-relaxed text-pretty">
              A count of opens, and nothing more. This system cannot see inside a tool session, so
              there is no history to show here beyond the totals above. The allowance of{' '}
              {number(cap)} is fixed configuration and is not editable from this screen.
            </p>
          </>
        )}
      </Drawer>
    </>
  );
}

function ToolPill({ tool }: { tool: ToolUse }) {
  const past = tool.used > tool.cap;

  return (
    <span
      title={`${tool.name}: ${tool.used} of ${tool.cap}`}
      style={{ ['--tone' as string]: past ? 'var(--h-rose)' : 'var(--h-cyan)' }}
      className="tinted inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[10.5px] font-semibold whitespace-nowrap"
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: past ? 'var(--h-rose)' : 'var(--h-cyan)' }}
      />
      {tool.name}
      <span className={NUM}>
        {tool.used}/{tool.cap}
      </span>
    </span>
  );
}

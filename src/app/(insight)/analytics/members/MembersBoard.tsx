'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import type { Person } from '@/lib/analytics/people';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { Drawer } from '@/components/ui/Drawer';
import { duration, number, NUM } from '@/components/analytics/Figures';
import { Chip, ChipRow, Journey } from '@/components/analytics/Journey';
import {
  Avatar,
  ChipWithBar,
  CompanyCell,
  DeviceCell,
  NumChip,
  PersonCell,
  Roster,
  RosterHead,
  RosterRow,
  RosterTd,
  RosterTh,
  SourcePill,
  WhenCell,
} from '@/components/analytics/People';
import { cn } from '@/lib/utils';

/**
 * Everybody who has ever signed up, with what they did before they did.
 *
 * No search box and no sort dropdown, unlike the customer usage screen. The
 * difference is the question each answers. That one is "which of these hundred
 * people should I talk to", which genuinely needs filtering. This one is "is the
 * product acquiring anybody, and where from", which is answered by the figures
 * above the table and by the order the table is already in.
 */
export function MembersBoard({ members, now }: { members: Person[]; now: number }) {
  const [open, setOpen] = useState<Person | null>(null);

  const peakViews = Math.max(1, ...members.map((m) => m.pageViews));

  return (
    <>
      <Card className="overflow-hidden">
        <CardTitle
          title="Members"
          description={`${number(members.length)} accounts, most recently active first. Click anyone for their journey.`}
        />

        {members.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="Nobody has signed up yet"
            description="A member appears here the first time somebody with an account opens a page. Their browsing from before they signed up is attached automatically where the tracking cookie survived."
          />
        ) : (
          <div className="px-5 py-3">
            <Roster>
              <RosterHead>
                <RosterTh>Person</RosterTh>
                <RosterTh>Company</RosterTh>
                <RosterTh align="right">Visits</RosterTh>
                <RosterTh align="right">Views</RosterTh>
                <RosterTh align="right">On screen</RosterTh>
                <RosterTh>First seen</RosterTh>
                <RosterTh>Last active</RosterTh>
                <RosterTh>Device</RosterTh>
                <RosterTh>Came from</RosterTh>
              </RosterHead>
              <tbody>
                {members.map((person, i) => (
                  <RosterRow
                    key={person.email}
                    email={person.email}
                    index={i}
                    onClick={() => setOpen(person)}
                  >
                    <RosterTd>
                      <PersonCell
                        email={person.email}
                        name={person.name}
                        photo={person.photo}
                        lastSeen={person.lastSeen}
                        now={now}
                        linked={person.preSignupPages}
                      />
                    </RosterTd>
                    <RosterTd>
                      <CompanyCell company={person.company} />
                    </RosterTd>
                    <RosterTd align="right">
                      <NumChip value={person.visits} tone="var(--h-indigo)" />
                    </RosterTd>
                    <RosterTd align="right">
                      <ChipWithBar value={person.pageViews} max={peakViews} tone="var(--h-cyan)" />
                    </RosterTd>
                    <RosterTd align="right">
                      <span className={cn(NUM, 'text-[12px] text-[var(--h-indigo)]')}>
                        {duration(person.seconds)}
                      </span>
                    </RosterTd>
                    <RosterTd>
                      <WhenCell iso={person.firstSeen} now={now} />
                    </RosterTd>
                    <RosterTd>
                      <WhenCell iso={person.lastSeen} now={now} />
                    </RosterTd>
                    <RosterTd>
                      <DeviceCell browser={person.browser} os={person.os} device={person.device} />
                    </RosterTd>
                    <RosterTd>
                      <SourcePill source={person.source} />
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
            <>
              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  email={open.email}
                  name={open.name}
                  photo={open.photo}
                  lastSeen={open.lastSeen}
                  now={now}
                  size={44}
                />
                <span className={cn(NUM, 'text-subtle text-[11.5px]')}>{open.email}</span>
              </div>
              <ChipRow>
                <Chip tone={open.preSignupPages > 0 ? 'var(--h-lime)' : 'var(--text-subtle)'}>
                  {open.preSignupPages > 0
                    ? `${number(open.preSignupPages)} pages before joining · ${number(open.visits)} visits since`
                    : `${number(open.visits)} visits, nothing linked from before`}
                </Chip>
                {open.company && <Chip tone="var(--h-violet)">{open.company}</Chip>}
                {open.browser && <Chip tone="var(--h-cyan)">{open.browser}</Chip>}
                {open.source && <Chip tone="var(--h-indigo)">&#8599; {open.source}</Chip>}
              </ChipRow>
            </>
          )
        }
      >
        {open && (
          <Journey
            events={open.journey}
            empty="No linked pre-signup activity for this person. They may have signed in without a tracked browsing session, or before tracking existed."
          />
        )}
      </Drawer>
    </>
  );
}

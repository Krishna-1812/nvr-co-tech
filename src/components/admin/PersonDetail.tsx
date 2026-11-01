'use client';

import type { PersonActivity } from '@/lib/analytics/activity';
import { TOOL_NAMES } from '@/lib/analytics/activity';
import type { Person } from '@/lib/analytics/report';
import { duration } from '@/lib/analytics/report';
import type { AdminAccountRow } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { Timeline } from './Chats';
import { stamp } from './when';

/**
 * Everything known about one person: the facts on the left, and on the right
 * everything they did, day by day (pages, questions to the chat, what they
 * typed and pressed, their work in a tool). Shared by the People list, where a
 * row opens to it, and the detail panel.
 *
 * A browser that later signed in is already filed under the account here, so
 * what they did before they had a name shows under their name.
 */
export function PersonDetail({
  person: p,
  activity,
  account,
  onPage,
  onThread,
}: {
  person: Person;
  activity?: PersonActivity;
  account?: AdminAccountRow;
  onPage?: (path: string) => void;
  onThread?: (key: string) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <dl className="grid grid-cols-2 content-start gap-2.5">
        {p.kind === 'account' && (
          <>
            <Fact label="Name" value={p.name ?? 'Not given'} />
            <Fact label="Email" value={p.email ?? 'Unknown'} />
            {account?.organization && <Fact label="Organisation" value={account.organization} />}
            {account?.role && <Fact label="Role" value={account.role} />}
            {account?.phone && <Fact label="Phone" value={account.phone} />}
            <Fact label="Account created" value={p.joined ? stamp(p.joined) : 'Unknown'} />
            <Fact label="Last sign-in" value={p.lastSignIn ? `${stamp(p.lastSignIn)}${p.provider ? ` · ${provider(p.provider)}` : ''}` : 'Unknown'} />
            {account && <Fact label="Email confirmed" value={account.confirmed_at ? stamp(account.confirmed_at) : 'Not yet'} />}
          </>
        )}
        <Fact label="First seen" value={stamp(p.firstSeen)} />
        <Fact label="Last seen" value={stamp(p.lastSeen)} />
        <Fact label="Visits" value={String(p.visits)} />
        <Fact label="Time spent" value={duration(p.seconds)} />
        <Fact label="Pages opened" value={String(p.views)} />
        <Fact label="Questions asked" value={String(activity?.questions ?? 0)} />
        <Fact label="Fields filled" value={String(activity?.fields ?? 0)} />
        <Fact label="Buttons pressed" value={String(activity?.clicks ?? 0)} />
        {activity?.tools.map((w) => (
          <Fact key={w.tool} label={TOOL_NAMES[w.tool]} value={`${w.saves} saves · last ${stamp(w.last, false)}${w.sealed ? ' · locked' : ''}`} wide />
        ))}
        <Fact label="Browsers" value={String(p.browsers)} />
        <Fact label="Requests" value={String(p.requests)} />
        <Fact label="Arrived from" value={p.source} />
        <Fact label="Location" value={p.place ?? 'Unknown'} />
        <Fact label="Device" value={[p.device, p.browser, p.os].filter(Boolean).join(' · ') || 'Unknown'} />
        <Fact label="Screen · language" value={[p.screen, p.language].filter(Boolean).join(' · ') || 'Unknown'} />
        <Fact label="IP address" value={p.ip ?? 'Unknown'} wide />
        {p.kind === 'visitor' && <Fact label="Visitor ID" value={p.key.slice(2)} wide />}
      </dl>

      <Timeline person={p} activity={activity} account={account} onPage={onPage} onThread={onThread} />
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('surface min-w-0 rounded-xl border px-3 py-2', wide && 'col-span-2')}>
      <dt className="a-label">{label}</dt>
      <dd className="mt-1 truncate text-[13px] font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}

export function initials(s: string): string {
  const parts = s.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function provider(p: string): string {
  return p === 'google' ? 'Google' : p === 'email' ? 'Email and password' : p;
}

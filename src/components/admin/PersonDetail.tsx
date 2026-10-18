'use client';

import { Globe } from 'lucide-react';
import type { Person } from '@/lib/analytics/report';
import { duration } from '@/lib/analytics/report';
import { cn } from '@/lib/utils';
import { stamp } from './when';

/**
 * Everything known about one person: the facts on the left, the pages they
 * opened (newest first, with the time on each) on the right. Shared by the
 * People list, where a row opens to it, and the detail panel.
 */
export function PersonDetail({ person: p, onPage }: { person: Person; onPage?: (path: string) => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <dl className="grid grid-cols-2 content-start gap-2.5">
        <Fact label="First seen" value={stamp(p.firstSeen)} />
        <Fact label="Last seen" value={stamp(p.lastSeen)} />
        <Fact label="Visits" value={String(p.visits)} />
        <Fact label="Time spent" value={duration(p.seconds)} />
        <Fact label="Pages opened" value={String(p.views)} />
        <Fact label="Browsers" value={String(p.browsers)} />
        <Fact label="Arrived from" value={p.source} />
        <Fact label="Location" value={p.place ?? 'Unknown'} />
        <Fact label="Device" value={[p.device, p.browser, p.os].filter(Boolean).join(' · ') || 'Unknown'} />
        <Fact label="Screen · language" value={[p.screen, p.language].filter(Boolean).join(' · ') || 'Unknown'} />
        <Fact label="IP address" value={p.ip ?? 'Unknown'} />
        <Fact label="Requests" value={String(p.requests)} />
        {p.kind === 'account' && (
          <>
            <Fact label="Account created" value={p.joined ? stamp(p.joined) : 'Unknown'} />
            <Fact label="Last sign-in" value={p.lastSignIn ? `${stamp(p.lastSignIn)}${p.provider ? ` · ${provider(p.provider)}` : ''}` : 'Unknown'} />
          </>
        )}
        {p.kind === 'visitor' && <Fact label="Visitor ID" value={p.key.slice(2)} wide />}
      </dl>

      <div className="min-w-0">
        <p className="a-label flex items-center gap-1.5">
          <Globe className="size-3" aria-hidden /> Pages, newest first
        </p>
        <ol className="relative mt-3 space-y-0.5 border-l border-dashed pl-4">
          {p.journey.map((j, i) => (
            <li key={`${j.at}-${i}`} className="relative">
              <span aria-hidden className="absolute top-3.5 -left-[21px] size-2 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--color-brand-500)]" />
              <button
                type="button"
                disabled={!onPage}
                onClick={() => onPage?.(j.path)}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-[13px] transition enabled:hover:bg-[var(--surface-sunken)]"
              >
                <span className="min-w-0 truncate font-medium" title={j.title ?? j.path}>
                  {j.path}
                </span>
                <span className="text-subtle shrink-0 text-[11.5px] tabular-nums">
                  {duration(j.seconds)} · {stamp(j.at)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
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

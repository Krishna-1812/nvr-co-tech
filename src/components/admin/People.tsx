'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, Globe, Laptop, MonitorSmartphone, Search, Smartphone, Tablet, UserRound } from 'lucide-react';
import type { Person } from '@/lib/analytics/report';
import { duration } from '@/lib/analytics/report';
import { cn } from '@/lib/utils';
import { ago, stamp } from './when';

/**
 * Everybody who came in the range, one row each: an account (every browser it
 * has used, added together) or an anonymous browser, known by the start of its
 * ID. Opening a row shows who they are, where they are, how they arrived, and
 * the pages they read with the time on each, newest first.
 */

type Filter = 'all' | 'account' | 'visitor';

const DEVICE_ICON = { Mobile: Smartphone, Tablet, Desktop: Laptop } as Record<string, typeof Laptop>;

export function People({ people, now }: { people: Person[]; now: number }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(40);

  // "See their visits" on a request, and a name in the accounts table, link to
  // #person-<key>: open that row when the address changes to it.
  useEffect(() => {
    const follow = () => {
      const key = decodeURIComponent(location.hash.replace(/^#person-/, ''));
      if (!key || key === location.hash) return;
      const at = people.findIndex((p) => p.key === key);
      if (at < 0) return;
      setFilter('all');
      setQuery('');
      setShown((n) => Math.max(n, at + 1));
      setOpen(key);
      requestAnimationFrame(() => document.getElementById(`person-${key}`)?.scrollIntoView({ block: 'start' }));
    };
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [people]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (filter !== 'all' && p.kind !== filter) return false;
      if (!q) return true;
      return [p.name, p.email, p.tag, p.place, p.source, p.browser, p.os, p.ip, ...p.journey.map((j) => j.path)]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [people, query, filter]);

  const counts = {
    all: people.length,
    account: people.filter((p) => p.kind === 'account').length,
    visitor: people.filter((p) => p.kind === 'visitor').length,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 border-b px-5 py-3.5 sm:px-6">
        <div className="surface-sunken flex gap-1 rounded-full border p-1">
          {(
            [
              ['all', 'Everyone'],
              ['account', 'Signed in'],
              ['visitor', 'Not signed in'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={cn(
                'rounded-full px-3 py-1 text-[12.5px] font-medium transition',
                filter === id ? 'elev-1 bg-[var(--surface-raised)] text-[var(--text-c)]' : 'text-muted hover:text-[var(--text-c)]',
              )}
            >
              {label} <span className="text-subtle tabular-nums">{counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="surface-sunken ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5 sm:max-w-xs">
          <Search className="text-subtle size-4 shrink-0" aria-hidden />
          <span className="sr-only">Search people</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, city, page…"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-subtle)] lg:text-sm"
          />
        </label>
      </div>

      {list.length === 0 ? (
        <p className="text-subtle px-6 py-14 text-center text-sm">
          {people.length === 0 ? 'Nobody has visited in this period yet.' : 'Nobody matches that.'}
        </p>
      ) : (
        <ul className="divide-y">
          {list.slice(0, shown).map((p) => (
            <Row key={p.key} person={p} now={now} open={open === p.key} onToggle={() => setOpen(open === p.key ? null : p.key)} />
          ))}
        </ul>
      )}

      {list.length > shown && (
        <div className="border-t px-6 py-3 text-center">
          <button type="button" onClick={() => setShown(shown + 60)} className="text-sm font-semibold hover:underline">
            Show more ({list.length - shown} left)
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ person: p, now, open, onToggle }: { person: Person; now: number; open: boolean; onToggle: () => void }) {
  const live = now - Date.parse(p.lastSeen) < 5 * 60_000;
  const Device = DEVICE_ICON[p.device ?? ''] ?? MonitorSmartphone;
  const title = p.kind === 'account' ? (p.name ?? p.email ?? 'Account') : `Visitor ${p.tag}`;
  const tone = p.kind === 'account' ? 'var(--color-brand-500)' : 'var(--status-draft)';

  return (
    <li id={`person-${p.key}`} className="scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 px-5 py-3.5 text-left transition hover:bg-[color-mix(in_oklab,var(--surface-sunken)_60%,transparent)] sm:px-6 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_6rem_6rem_auto]"
      >
        <span
          aria-hidden
          style={{ '--tone': tone } as CSSProperties}
          className={cn(
            'relative grid size-10 place-items-center rounded-2xl border text-[12px] font-bold tracking-wide',
            p.kind === 'account' ? 'tinted' : 'surface-sunken text-muted',
          )}
        >
          {p.kind === 'account' ? initials(p.name ?? p.email ?? '?') : <UserRound className="size-4" />}
          {live && <span className="a-blip absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--status-approved)]" />}
        </span>

        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold tracking-tight">{title}</span>
            {p.kind === 'account' && p.name && p.email && <span className="text-subtle hidden truncate text-[12px] sm:inline">{p.email}</span>}
          </span>
          <span className="text-muted mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px]">
            <Device className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {[p.place, p.browser && p.os ? `${p.browser} on ${p.os}` : null].filter(Boolean).join(' · ') || 'Unknown device'}
            </span>
          </span>
        </span>

        <span className="text-muted hidden min-w-0 text-[12px] md:block">
          <span className="block truncate">From {p.source}</span>
          <span className="text-subtle block truncate">{live ? 'Here now' : `Last seen ${ago(p.lastSeen, now)}`}</span>
        </span>

        <Stat value={`${p.visits}`} label={p.visits === 1 ? 'visit' : 'visits'} />
        <Stat value={duration(p.seconds)} label="time spent" />

        <ChevronDown className={cn('text-subtle size-4 shrink-0 transition-transform duration-300', open && 'rotate-180')} aria-hidden />

        <span className="text-subtle col-span-2 col-start-2 flex gap-3 text-[12px] md:hidden">
          <span>{p.visits} {p.visits === 1 ? 'visit' : 'visits'}</span>
          <span>{duration(p.seconds)}</span>
          <span className="truncate">{live ? 'Here now' : ago(p.lastSeen, now)}</span>
        </span>
      </button>

      {open && (
        <div className="grid animate-[rise_0.4s_cubic-bezier(0.22,1,0.36,1)_backwards] gap-5 bg-[color-mix(in_oklab,var(--surface-sunken)_55%,transparent)] px-5 pt-1 pb-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <dl className="grid grid-cols-2 content-start gap-2.5">
            <Fact label="First seen" value={stamp(p.firstSeen)} />
            <Fact label="Last seen" value={stamp(p.lastSeen)} />
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
                <li key={`${j.at}-${i}`} className="relative py-1.5">
                  <span aria-hidden className="absolute top-3 -left-[21px] size-2 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--color-brand-500)]" />
                  <span className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate font-medium" title={j.title ?? j.path}>
                      {j.path}
                    </span>
                    <span className="text-subtle shrink-0 text-[11.5px] tabular-nums">
                      {duration(j.seconds)} · {stamp(j.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="hidden text-right md:block">
      <span className="block text-[14px] font-semibold tabular-nums">{value}</span>
      <span className="text-subtle block text-[11px]">{label}</span>
    </span>
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

function initials(s: string): string {
  const parts = s.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function provider(p: string): string {
  return p === 'google' ? 'Google' : p === 'email' ? 'Email and password' : p;
}

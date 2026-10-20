'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { Check, Copy, FileText, RotateCcw, Search, Sparkles } from 'lucide-react';
import { setNoticeHandled } from '@/app/actions/notices';
import { dueWords, STATUS_WORDS, type ClientGroup, type NoticeItem } from '@/lib/notices/view';
import { cn } from '@/lib/utils';
import { ago, stamp } from './when';

/**
 * The rows of Tax Notice Watch (/tax-notices): one proceeding each,
 * with what is new on it, when a response is due, its files, and the one
 * thing an admin does here, marking it handled.
 */

const tone = (v: string) => ({ '--tone': v }) as CSSProperties;

/** Red when due within two days or missed, amber within a week, quiet after. */
function dueTone(dueIn: number) {
  if (dueIn <= 2) return 'var(--status-rejected)';
  if (dueIn <= 7) return 'var(--status-warn)';
  return 'var(--status-draft)';
}

const isoDay = (d: string) => stamp(`${d}T00:00:00+05:30`, false);

function Chip({ children, v }: { children: React.ReactNode; v?: string }) {
  return (
    <span
      style={v ? tone(v) : undefined}
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', v ? 'tinted' : 'surface-sunken text-muted')}
    >
      {children}
    </span>
  );
}

function Handled({ item }: { item: NoticeItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const flip = (handled: boolean) =>
    start(async () => {
      setError(null);
      const res = await setNoticeHandled({ key: item.key, handled });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      {item.handled ? (
        <>
          <span style={tone('var(--status-approved)')} className="tinted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold">
            <Check className="size-3.5" aria-hidden /> Handled
          </span>
          <span className="text-subtle text-[11.5px]">
            {stamp(item.handled.at, false)}
            {item.handled.by ? ` · ${item.handled.by}` : ''}
          </span>
          <button type="button" disabled={pending} onClick={() => flip(false)} className="text-subtle inline-flex items-center gap-1 text-[11.5px] font-semibold underline-offset-2 hover:text-[var(--text-c)] hover:underline">
            <RotateCcw className="size-3" aria-hidden /> Undo
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => flip(true)}
          className="surface-sunken inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition hover:border-[var(--border-strong)] disabled:opacity-60"
        >
          <Check className="size-3.5" aria-hidden /> {pending ? 'Saving…' : 'Mark handled'}
        </button>
      )}
      {error && (
        <p role="alert" style={tone('var(--status-rejected)')} className="tinted max-w-[16rem] rounded-lg border px-2 py-1 text-[12px]">
          {error}
        </p>
      )}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={done ? 'Copied' : label}
      onClick={() =>
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => {},
        )
      }
      className="text-subtle hover:text-[var(--text-c)] inline-flex size-6 shrink-0 items-center justify-center rounded-md transition"
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

/** The alert without the proceeding's name, which the row already shows as its title. */
function freshWords(item: NoticeItem) {
  const d = item.fresh!.detail;
  if (/^New proceeding:/i.test(d)) return 'New proceeding on the portal';
  const rest = d.startsWith(item.name) ? d.replace(/^[^:]*:\s*/, '') : d;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export function NoticeRow({ item, urls, showClient = false }: { item: NoticeItem; urls: Record<string, string>; showClient?: boolean }) {
  const years = [item.ay && !/not available/i.test(item.ay) ? `AY ${item.ay}` : null, item.fy && !/not available/i.test(item.fy) ? `FY ${item.fy}` : null].filter(Boolean).join(' · ');
  return (
    <li className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6', item.handled && 'opacity-75')}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0">
          {showClient && <p className="text-subtle truncate text-[12px] font-semibold tracking-wide uppercase">{item.client}</p>}
          <p className="text-[15px] leading-snug font-semibold tracking-tight">
            {item.name}
            {years && <span className="text-muted font-normal"> · {years}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.dueIn !== null && !item.handled && <Chip v={dueTone(item.dueIn)}>{dueWords(item.dueIn)} · {isoDay(item.due!)}</Chip>}
          {item.dueIn !== null && item.handled && <Chip>Was due {isoDay(item.due!)}</Chip>}
          <Chip v={item.tab === 'action' ? 'var(--color-brand-500)' : undefined}>{item.tab === 'action' ? 'For your action' : 'For information'}</Chip>
          {item.noticeCount !== null && <Chip>{item.noticeCount} notice{item.noticeCount === 1 ? '' : 's'}</Chip>}
          {item.latest && (
            <Chip>
              Latest {isoDay(item.latest.date)}
              {item.latest.status ? ` · ${item.latest.status}` : ''}
            </Chip>
          )}
          {item.markedNew && !item.fresh && <Chip v="var(--h-cyan)">New on the portal</Chip>}
        </div>
        {item.fresh && (
          <p style={tone('var(--status-warn)')} className="tinted flex items-start gap-1.5 rounded-xl border px-3 py-2 text-[13px]">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {freshWords(item)} <span className="opacity-75">· found {stamp(item.fresh.at)}</span>
            </span>
          </p>
        )}
        {(item.facts.dins.length > 0 || item.facts.sections.length > 0) && (
          <dl className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
            {item.facts.sections.length > 0 && (
              <div className="flex gap-1.5">
                <dt className="text-subtle">Section</dt>
                <dd className="font-medium text-[var(--text-c)]">{item.facts.sections.join(', ')}</dd>
              </div>
            )}
            {item.facts.dins.map((din) => (
              <div key={din} className="flex min-w-0 items-center gap-1.5">
                <dt className="text-subtle">DIN</dt>
                <dd className="min-w-0 truncate font-mono text-[12px] text-[var(--text-c)]">{din}</dd>
                <CopyButton value={din} label="Copy DIN" />
              </div>
            ))}
          </dl>
        )}
        {item.handled?.note && <p className="text-muted text-[13px]">Note: {item.handled.note}</p>}
        {item.docs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {item.docs.map((d) =>
              urls[d.path] ? (
                <li key={d.id}>
                  <a
                    href={urls[d.path]}
                    target="_blank"
                    rel="noreferrer"
                    className="surface-sunken inline-flex max-w-[18rem] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition hover:border-[var(--border-strong)]"
                  >
                    <FileText className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{d.name}</span>
                  </a>
                </li>
              ) : (
                <li key={d.id} className="text-subtle inline-flex max-w-[18rem] items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1 text-[12.5px]" title="The file could not be opened from here">
                  <FileText className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{d.name}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
      <Handled item={item} />
    </li>
  );
}

export function NoticeList({ items, urls, showClient = false, empty }: { items: NoticeItem[]; urls: Record<string, string>; showClient?: boolean; empty: string }) {
  if (!items.length) return <p className="text-subtle px-6 py-10 text-center text-sm text-pretty">{empty}</p>;
  return (
    <ul className="divide-y">
      {items.map((i) => (
        <NoticeRow key={i.key} item={i} urls={urls} showClient={showClient} />
      ))}
    </ul>
  );
}

type Filter = 'all' | 'look' | 'unchecked';

/** Whether a client has anything a person should look at today. */
const needsLook = (c: ClientGroup) => c.items.some((i) => !i.handled && (i.fresh || (i.dueIn !== null && i.dueIn <= 7 && i.dueIn >= -14)));
const unchecked = (c: ClientGroup) => c.inSheet && !!c.status && c.status !== 'ok';

/**
 * Every client, one folding row each, with a search and two quick filters so
 * the screen still works at a hundred logins. A client with something to look
 * at opens on its own.
 */
export function ClientBook({ clients, urls, now }: { clients: ClientGroup[]; urls: Record<string, string>; now: number }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const counts = { all: clients.length, look: clients.filter(needsLook).length, unchecked: clients.filter(unchecked).length };
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (filter === 'all' || (filter === 'look' ? needsLook(c) : unchecked(c))) &&
        (!q || c.name.toLowerCase().includes(q) || c.pan.toLowerCase().includes(q) || c.items.some((i) => i.name.toLowerCase().includes(q))),
    );
  }, [clients, query, filter]);

  return (
    <div>
      {clients.length > 1 && (
        <div className="flex flex-wrap items-center gap-2.5 border-b px-5 py-3.5 sm:px-6">
          <div className="surface-sunken flex max-w-full gap-1 overflow-x-auto rounded-full border p-1">
            {(
              [
                ['all', 'All'],
                ['look', 'Needs a look'],
                ['unchecked', 'Not checked'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={cn(
                  'rounded-full px-3 py-1 text-[12.5px] font-medium whitespace-nowrap transition',
                  filter === id ? 'elev-1 bg-[var(--surface-raised)] text-[var(--text-c)]' : 'text-muted hover:text-[var(--text-c)]',
                )}
              >
                {label} <span className="text-subtle tabular-nums">{counts[id]}</span>
              </button>
            ))}
          </div>
          <label className="surface-sunken ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5 sm:max-w-xs">
            <Search className="text-subtle size-4 shrink-0" aria-hidden />
            <span className="sr-only">Search clients</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Client, PAN or proceeding…"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-subtle)] lg:text-sm"
            />
          </label>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-subtle px-6 py-12 text-center text-sm">{clients.length ? 'No client matches that.' : 'No clients yet.'}</p>
      ) : (
        <div className="divide-y">
          {list.map((c) => {
            const open = c.items.filter((i) => !i.handled).length;
            const bad = unchecked(c);
            return (
              <details key={c.pan} className="group" open={needsLook(c)}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[color-mix(in_oklab,var(--surface-sunken)_60%,transparent)] sm:px-6">
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      style={tone(bad ? 'var(--status-rejected)' : needsLook(c) ? 'var(--status-warn)' : 'var(--status-approved)')}
                      className="tinted grid size-9 shrink-0 place-items-center rounded-xl border text-[13px] font-semibold"
                    >
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block truncate font-semibold', !c.inSheet && 'text-muted')}>
                        {c.name}
                        {!c.inSheet && <span className="text-subtle font-normal"> · no longer in the sheet</span>}
                      </span>
                      <span className="text-subtle block truncate text-[12px]">
                        <span className="font-mono">{c.pan}</span>
                        {' · '}
                        {bad ? (STATUS_WORDS[c.status!] ?? 'Not checked') : c.lastOk ? `read ${ago(c.lastOk, now)}` : 'not read yet'}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-muted text-[12.5px] tabular-nums whitespace-nowrap">
                      {c.items.length} <span className="hidden sm:inline">proceeding{c.items.length === 1 ? '' : 's'}</span>
                      {open !== c.items.length ? ` · ${open} open` : ''}
                    </span>
                    <span aria-hidden className="text-subtle transition group-open:rotate-90">
                      ›
                    </span>
                  </span>
                </summary>
                <div className="surface-sunken border-t">
                  <NoticeList items={c.items} urls={urls} empty={c.lastOk ? 'No proceedings on this account.' : 'Not read yet.'} />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : (words[0]?.[1] ?? ''))).toUpperCase() || '·';
}

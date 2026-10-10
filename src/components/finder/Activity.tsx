'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Building2,
  Clock,
  Coins,
  Download,
  ListChecks,
  MessageSquare,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { buttonClass, Card, CardTitle, EmptyState, Skeleton } from '@/components/ui/primitives';
import { HeroStat, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { cn } from '@/lib/utils';
import type { Entity } from './filters';
import type { Row } from './store';

/**
 * Everything Contact Finder has already done, on one screen.
 *
 * Three things, and they are the same story told three ways: what was asked
 * (history), what was kept out of the answers (the working list), and what the
 * asking cost (the spend). They sit here rather than on the search screen
 * because none of them is part of setting up a search — they are about every
 * search — and because a rail that has to hold both a search form and a ledger
 * ends up serving neither.
 *
 * The spend is the hero. It is the one figure on this screen somebody comes to
 * check, and it is the one that needs reading against the other two: a month of
 * credits is a meter reading on its own and a judgement once it sits beside
 * what it bought. So the hero carries all three counts, and the panels under it
 * are the detail behind two of them.
 *
 * ── The one thing this screen is careful about ─────────────────────────────
 *
 * Reopening. The rows behind a history entry cost credits to describe and cannot
 * be rebuilt from a URL, so leaving the search screen must not throw them away
 * and getting back to one must not charge for it again. Reopening from here
 * navigates to `/contacts?reopen=<id>`, and the search screen restores the
 * stored result set rather than running the search a second time. That is what
 * makes this a destination instead of a drawer.
 */

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const n = (v: number) => v.toLocaleString('en-IN');

function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Which stretch of the timeline an entry belongs to.
 *
 * Calendar days rather than elapsed hours, because "Yesterday" means the day
 * before today to a reader, not anything between 24 and 48 hours ago — a search
 * run at eleven last night is yesterday's at nine this morning.
 */
function bucket(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Earlier';
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(then)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  if (days < 31) return 'Earlier this month';
  return 'Older';
}

function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export type HistoryItem = {
  id: number;
  entity: string;
  label: string | null;
  total: number | null;
  credits: number;
  answer: string | null;
  created_at: string;
  rows: number;
};

export type ListRow = { entity: string; dedupe_key: string; row: Row; added_at: string };

type Spend = { month: number; today: number };

/** What each kind of entry is, in a word and a mark. */
const KIND: Readonly<Record<string, { icon: typeof Users; word: string; tone: string }>> = {
  people: { icon: Users, word: 'people', tone: 'var(--h-indigo)' },
  companies: { icon: Building2, word: 'companies', tone: 'var(--h-cyan)' },
  chat: { icon: MessageSquare, word: 'answer', tone: 'var(--h-violet)' },
  contact: { icon: Sparkles, word: 'contact', tone: 'var(--h-amber)' },
  company_profile: { icon: Building2, word: 'profile', tone: 'var(--h-amber)' },
  revealed: { icon: Sparkles, word: 'revealed', tone: 'var(--h-emerald)' },
};

/** A count beside a panel's title, in the panel's own tone. */
function Count({ value, tone }: { value: number | undefined; tone: string }) {
  if (value == null || value === 0) return null;
  return (
    <span
      style={{ '--tone': tone } as CSSProperties}
      className="tinted rounded-full border px-2.5 py-0.5 text-[12px] font-semibold tabular-nums"
    >
      {n(value)}
    </span>
  );
}

// ─── The hero ────────────────────────────────────────────────────────────────

/**
 * The month's spend, set as the answer, with what it bought beside it.
 *
 * Each figure waits for its own request: a tile whose number has not arrived
 * shows a placeholder rather than a zero, because "0 searches" while the history
 * is still loading is a claim, and a wrong one.
 */
function ActivityHero({
  spend,
  entries,
  rows,
}: {
  spend: Spend | null;
  entries: HistoryItem[] | null;
  rows: ListRow[] | null;
}) {
  const people = (rows ?? []).filter((r) => r.entity !== 'companies').length;
  const companies = (rows ?? []).length - people;
  const parts = [
    { key: 'people', label: 'People', value: people, tone: 'var(--h-indigo)' },
    { key: 'companies', label: 'Companies', value: companies, tone: 'var(--h-cyan)' },
  ].filter((p) => p.value > 0);
  const listed = people + companies;

  const wait = <Skeleton className="mt-1 h-6 w-14 rounded-lg" />;

  return (
    <ToolHero
      label="Spent this month · Contact Finder"
      pill={
        spend
          ? spend.today > 0
            ? {
                icon: Coins,
                text: `${n(spend.today)} today`,
                tone: 'var(--h-amber)',
              }
            : { text: 'Nothing spent today', tone: 'var(--status-approved)' }
          : undefined
      }
      variant="figure"
      title={
        spend ? (
          <>
            {n(spend.month)}{' '}
            <span className="text-muted text-[0.42em] font-medium tracking-tight">
              {spend.month === 1 ? 'credit' : 'credits'}
            </span>
          </>
        ) : (
          <span className="block h-[0.95em] w-56 max-w-full animate-pulse rounded-2xl bg-[var(--surface-sunken)]" />
        )
      }
      sub="Drawn from the shared Apollo key since the first of the month, across searches, answers and reveals — beside what those searches left you with."
      glow="var(--h-amber)"
      scene={
        <ArchScene
          motif="seekers"
          className="h-full min-h-[18rem]"
          seal={
            spend && spend.month > 0 ? (
              <SealFigure
                value={n(spend.month)}
                note={spend.month === 1 ? 'credit this month' : 'credits this month'}
              />
            ) : undefined
          }
        />
      }
    >
      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <HeroStat
          strong
          label="This month"
          value={spend ? n(spend.month) : '—'}
          note="credits since the first"
        />
        <HeroStat
          label="Today"
          tone="var(--h-amber)"
          value={spend ? n(spend.today) : wait}
          note="part of the month, not on top"
        />
        <HeroStat
          label="Searches kept"
          tone="var(--h-violet)"
          value={entries ? n(entries.length) : wait}
          note="each reopens for nothing"
        />
        <HeroStat
          label="On your list"
          tone="var(--h-emerald)"
          value={rows ? n(rows.length) : wait}
          note="rows kept across searches"
        />
      </div>

      {/*
        What the list is made of, people against companies. Only drawn when
        there is a list: a bar with nothing in it is a picture of nothing.
      */}
      {listed > 0 && (
        <div className="mt-7 max-w-xl">
          <p className="a-label">What you kept</p>
          <div className="mt-2.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {parts.map((p, i) => (
              <span
                key={p.key}
                className="h-full origin-left animate-[grow_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards] first:rounded-l-full last:rounded-r-full"
                style={{
                  flexGrow: p.value,
                  flexBasis: 0,
                  background: p.tone,
                  animationDelay: `${150 + i * 120}ms`,
                }}
              />
            ))}
          </div>
          <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px]">
            {parts.map((p) => (
              <div key={p.key} className="flex items-center gap-1.5">
                <dt className="text-muted inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-[3px]" style={{ background: p.tone }} />
                  {p.label}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {n(p.value)}{' '}
                  <span className="text-subtle font-normal">
                    · {Math.round((p.value / listed) * 100)}%
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link href="/contacts" className={buttonClass({ variant: 'primary', className: 'group' })}>
          <Search className="size-4" aria-hidden />
          New search
          <ArrowUpRight
            className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </Link>
        {/*
          The caveat sits under the figures rather than above them, because it
          is about how to read them and there is no point reading it first.
        */}
        <p className="text-subtle max-w-md text-[12px] leading-snug text-pretty">
          Never a balance and never a remaining: nothing this key can reach reports the account
          total, and the same key funds other features, so any such figure would be a guess.
        </p>
      </div>
    </ToolHero>
  );
}

// ─── The whole screen ────────────────────────────────────────────────────────

export function ActivityBoard() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryItem[] | null>(null);
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [spend, setSpend] = useState<Spend | null>(null);

  /*
   * Three requests, fired together rather than in sequence. They are
   * independent — none of the three needs an answer from another — and running
   * them one after the other would make the last panel arrive third for no
   * reason. Each settles its own piece of state, so a slow one never holds up
   * a fast one.
   *
   * Every catch settles rather than leaves the panel loading forever. An empty
   * list and a failed request look different on this screen only in that a
   * failure has nothing to say; a skeleton spinning indefinitely would be the
   * one state that claims something is still coming when nothing is.
   */
  useEffect(() => {
    let live = true;

    void fetch('/api/finder/history')
      .then((r) => r.json() as Promise<{ entries?: HistoryItem[] }>)
      .then((d) => {
        if (live) setEntries(d.entries ?? []);
      })
      .catch(() => {
        if (live) setEntries([]);
      });

    void fetch('/api/finder/list')
      .then((r) => r.json() as Promise<{ rows?: ListRow[] }>)
      .then((d) => {
        if (live) setRows(d.rows ?? []);
      })
      .catch(() => {
        if (live) setRows([]);
      });

    void fetch('/api/finder/credits')
      .then((r) => r.json() as Promise<{ month?: number; today?: number }>)
      .then((d) => {
        if (live) setSpend({ month: d.month ?? 0, today: d.today ?? 0 });
      })
      .catch(() => {
        if (live) setSpend({ month: 0, today: 0 });
      });

    return () => {
      live = false;
    };
  }, []);

  const removeEntry = useCallback(async (id: number) => {
    setEntries((prev) => (prev ?? []).filter((e) => e.id !== id));
    await fetch(`/api/finder/history/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const removeRow = useCallback(async (entry: ListRow) => {
    setRows((prev) => (prev ?? []).filter((r) => r.dedupe_key !== entry.dedupe_key));
    await fetch(
      `/api/finder/list?entity=${encodeURIComponent(entry.entity)}&key=${encodeURIComponent(entry.dedupe_key)}`,
      { method: 'DELETE' },
    ).catch(() => {});
  }, []);

  /**
   * Take the list away as a file.
   *
   * No filters and no meta go with it, unlike an export from the results table:
   * these rows came from several searches and belong to none of them, so a
   * "filters used" sheet here would be describing whichever search happened to
   * be last. The route treats both as optional and writes the rows alone.
   */
  const exportRows = useCallback((entity: Entity, group: Row[]) => {
    if (group.length === 0) return;
    void fetch('/api/finder/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity, rows: group, format: 'xlsx' }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('export failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download =
          response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
          'contact-finder.xlsx';
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }, []);

  const people = (rows ?? []).filter((r) => r.entity !== 'companies');
  const companies = (rows ?? []).filter((r) => r.entity === 'companies');

  /*
   * The history in its stretches, newest first. The API already returns it in
   * that order, so grouping only has to cut where the label changes — it never
   * re-sorts, and an entry cannot end up under a heading out of sequence.
   */
  const now = new Date();
  const stretches: { label: string; items: HistoryItem[] }[] = [];
  for (const entry of entries ?? []) {
    const label = bucket(entry.created_at, now);
    const last = stretches[stretches.length - 1];
    if (last?.label === label) last.items.push(entry);
    else stretches.push({ label, items: [entry] });
  }

  return (
    <div className="space-y-6">
      <ActivityHero spend={spend} entries={entries} rows={rows} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ── History ── */}
        <Card className="min-w-0">
          <CardTitle
            icon={<Clock className="size-4" aria-hidden />}
            title="History"
            description="Kept for 90 days, then retired. Reopening one costs nothing — that is the point of it being here."
            action={<Count value={entries?.length} tone="var(--h-violet)" />}
          />

          {entries === null ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <Skeleton className="h-[4.5rem] flex-1 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<Clock className="size-6" aria-hidden />}
              title="Nothing yet"
              description="Searches, answers and revealed contacts land here as you go, and any of them reopens for nothing."
              action={
                <Link href="/contacts" className={buttonClass({ variant: 'primary' })}>
                  <Search className="size-4" aria-hidden />
                  Run a search
                </Link>
              }
            />
          ) : (
            <div className="space-y-6 p-5 sm:p-6">
              {stretches.map((stretch) => (
                <section key={stretch.label} aria-label={stretch.label}>
                  <p className="a-label mb-3 flex items-center gap-2">
                    {stretch.label}
                    <span className="text-subtle font-normal tracking-normal normal-case tabular-nums">
                      · {stretch.items.length}
                    </span>
                  </p>

                  {/*
                    A timeline rather than a list: each entry hangs off one rule
                    by its kind's mark, so a run of searches reads as a sequence
                    of things done, newest at the top, not as a stack of cards.
                  */}
                  <ol className="stagger">
                    {stretch.items.map((entry, i) => {
                      const kind = KIND[entry.entity] ?? KIND.people;
                      const Icon = kind.icon;
                      const last = i === stretch.items.length - 1;
                      return (
                        <li key={entry.id} className={cn('relative pl-12', !last && 'pb-3')}>
                          {!last && (
                            <span
                              aria-hidden
                              className="absolute top-10 bottom-0 left-[17px] w-px bg-[var(--border-c)]"
                            />
                          )}
                          <span
                            aria-hidden
                            className="tinted a-inner absolute top-0.5 left-0 grid size-9 place-items-center rounded-xl border"
                            style={{ '--tone': kind.tone } as CSSProperties}
                          >
                            <Icon className="size-4" />
                          </span>

                          <div className="surface-sunken group a-lift relative flex items-start gap-2 rounded-2xl border p-3.5">
                            <button
                              type="button"
                              onClick={() => router.push(`/contacts?reopen=${entry.id}`)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="truncate text-sm font-semibold tracking-tight">
                                {entry.label || 'Untitled search'}
                              </p>
                              {entry.answer && (
                                <p className="text-muted mt-1 line-clamp-2 text-[13px] leading-relaxed">
                                  {entry.answer}
                                </p>
                              )}
                              <p className="text-subtle mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                                <span>{ago(entry.created_at)}</span>
                                {entry.rows > 0 && (
                                  <span className="tabular-nums">
                                    <span className="font-semibold text-[var(--text-c)]">
                                      {n(entry.rows)}
                                    </span>{' '}
                                    {kind.word}
                                    {entry.total != null && entry.total > entry.rows
                                      ? ` of ${n(entry.total)}`
                                      : ''}
                                  </span>
                                )}
                                {/* Zero is not shown: a search that cost nothing is
                                    the normal case, and a column of "0 credits" would
                                    read as a meter rather than as a price. */}
                                {entry.credits > 0 && (
                                  <span
                                    className="tinted inline-flex items-center gap-1 rounded-full border px-2 py-px font-medium tabular-nums"
                                    style={{ '--tone': 'var(--h-amber)' } as CSSProperties}
                                  >
                                    <Coins className="size-3" aria-hidden />
                                    {entry.credits} {entry.credits === 1 ? 'credit' : 'credits'}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 font-medium text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100">
                                  Reopen free
                                  <ArrowUpRight className="size-3" aria-hidden />
                                </span>
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => void removeEntry(entry.id)}
                              aria-label={`Delete ${entry.label ?? 'entry'}`}
                              className="text-subtle shrink-0 rounded-full p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-[var(--surface-raised)] hover:text-[var(--status-rejected)] focus-visible:opacity-100"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </Card>

        {/* ── The working list ── */}
        <Card className="min-w-0">
          <CardTitle
            icon={<ListChecks className="size-4" aria-hidden />}
            title="Your list"
            description="Rows kept across searches and both tabs, up to 500. Adding somebody twice keeps one row, and a revealed row keeps what you paid for."
            action={<Count value={rows?.length} tone="var(--h-emerald)" />}
          />

          {rows === null ? (
            <div className="space-y-2 p-5 sm:p-6">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" aria-hidden />}
              title="Nothing on the list"
              description="Tick rows in the results and choose Add to list. They stay here while you run the next search."
            />
          ) : (
            <div className="space-y-6 p-5 sm:p-6">
              {(
                [
                  ['people', people] as const,
                  ['companies', companies] as const,
                ] satisfies readonly (readonly [Entity, ListRow[]])[]
              ).map(([entity, group]) =>
                group.length === 0 ? null : (
                  <section key={entity} aria-label={entity === 'companies' ? 'Companies' : 'People'}>
                    <div className="mb-3 flex items-center gap-2">
                      <p className="a-label">
                        {n(group.length)}{' '}
                        {entity === 'companies'
                          ? group.length === 1
                            ? 'company'
                            : 'companies'
                          : group.length === 1
                            ? 'person'
                            : 'people'}
                      </p>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() =>
                          exportRows(
                            entity,
                            group.map((g) => g.row),
                          )
                        }
                        className={buttonClass({ size: 'sm' })}
                      >
                        <Download className="size-3.5" aria-hidden />
                        Export these
                      </button>
                    </div>

                    <ul className="space-y-1.5">
                      {group.map((entry) => {
                        const row = entry.row ?? {};
                        const primary =
                          s(row.full_name) ||
                          s(row.name) ||
                          s(row.primary_domain) ||
                          'Untitled row';
                        const secondary =
                          [s(row.title), s(row.organization_name)].filter(Boolean).join(' · ') ||
                          [s(row.industry), s(row.primary_domain)].filter(Boolean).join(' · ');
                        const tone = entity === 'companies' ? 'var(--h-cyan)' : 'var(--h-indigo)';

                        return (
                          <li
                            key={entry.dedupe_key}
                            className="surface-sunken group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition hover:border-[var(--border-strong)]"
                          >
                            <span
                              aria-hidden
                              style={{ '--tone': tone } as CSSProperties}
                              className="tinted grid size-8 shrink-0 place-items-center rounded-xl border text-[11px] font-bold"
                            >
                              {monogram(primary)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{primary}</p>
                              {secondary && (
                                <p className="text-subtle truncate text-xs">{secondary}</p>
                              )}
                            </div>
                            {row.enriched === true && (
                              <span
                                className="tinted inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                                style={{ '--tone': 'var(--h-emerald)' } as CSSProperties}
                              >
                                <Sparkles className="size-3" aria-hidden />
                                revealed
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => void removeRow(entry)}
                              aria-label={`Remove ${primary}`}
                              className="text-subtle shrink-0 rounded-full p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-[var(--surface-raised)] hover:text-[var(--status-rejected)] focus-visible:opacity-100"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ),
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

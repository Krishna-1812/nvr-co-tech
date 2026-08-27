'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Clock,
  Coins,
  Download,
  ListChecks,
  MessageSquare,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { StatTile } from '@/components/analytics/Figures';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
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

// ─── The frame each of the three sits in ─────────────────────────────────────

/**
 * One of the three, with its own heading rather than a tab.
 *
 * A tab would put two of the three behind a click, and the whole point of
 * collecting them on one screen is being able to see the spend and what caused
 * it at the same time. The tone is carried on the icon tile and on a hairline
 * under the heading, which is enough to tell three panels apart without three
 * coloured boxes competing down the page.
 */
function Section({
  icon,
  title,
  note,
  tone,
  count,
  action,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  tone: string;
  /** Rendered beside the title. Omitted while the data is still arriving. */
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('surface-lit relative overflow-hidden rounded-2xl', className)}
      style={{ ['--tone' as string]: tone }}
    >
      {/* A wash of the section's own colour behind its heading, so the three
          read as different things rather than as three identical boxes. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-12 size-48 rounded-full opacity-[0.13] blur-3xl"
        style={{ background: `radial-gradient(circle, ${tone}, transparent 70%)` }}
      />

      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg border"
          style={{
            color: tone,
            borderColor: `color-mix(in oklab, ${tone} 28%, var(--border-c))`,
            background: `color-mix(in oklab, ${tone} 10%, var(--surface-sunken))`,
          }}
          aria-hidden
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            {title}
            {count != null && count > 0 && (
              <span className="numeric tinted rounded px-1.5 py-0.5 text-[11px] font-semibold">
                {count.toLocaleString('en-IN')}
              </span>
            )}
          </h2>
          <p className="text-subtle mt-0.5 text-xs leading-relaxed text-pretty">{note}</p>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="relative">{children}</div>
    </section>
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

  return (
    <div className="space-y-4">
      {/* ── Credits spent ── */}
      <Section
        icon={<Coins className="size-4" aria-hidden />}
        title="Credits spent"
        note="What Contact Finder has drawn from the shared Apollo key."
        tone="var(--h-amber)"
      >
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {spend === null ? (
            <>
              <Skeleton className="h-[7.5rem] rounded-2xl" />
              <Skeleton className="h-[7.5rem] rounded-2xl" />
              <Skeleton className="h-[7.5rem] rounded-2xl" />
            </>
          ) : (
            <>
              <StatTile
                label="This month"
                value={spend.month.toLocaleString('en-IN')}
                hint="Since the first, across searches, answers and reveals."
                icon={<Coins className="size-3.5" aria-hidden />}
                tone="var(--h-amber)"
                emphasis
              />
              <StatTile
                label="Today"
                value={spend.today.toLocaleString('en-IN')}
                hint="Part of the month's figure, not on top of it."
                icon={<Clock className="size-3.5" aria-hidden />}
                tone="var(--h-rose)"
              />
              {/*
                What the money bought, beside what it cost. A spend figure on
                its own is a meter reading; the two together are the only way to
                see whether a month of credits produced anything worth keeping.
              */}
              <StatTile
                label="Kept from it"
                value={(rows?.length ?? 0).toLocaleString('en-IN')}
                hint="Rows on the working list now, gathered across every search."
                icon={<ListChecks className="size-3.5" aria-hidden />}
                tone="var(--h-emerald)"
              />
            </>
          )}
        </div>

        {/*
          The caveat sits under the figures rather than in the heading, because
          it is about how to read them and there is no point reading it first.
        */}
        <p className="text-subtle border-t px-5 py-3 text-xs leading-relaxed text-pretty">
          Never a balance and never a remaining: no endpoint reachable with this key reports the
          account total, and the same key funds other features, so any such figure would be a
          guess. What the ledger knows exactly is what Contact Finder spent.
        </p>
      </Section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* ── History ── */}
        <Section
          icon={<Clock className="size-4" aria-hidden />}
          title="History"
          note="Kept for 90 days, then retired. Reopening one costs nothing — that is the point of it being here."
          tone="var(--h-indigo)"
          count={entries?.length}
        >
          {entries === null ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<Clock className="size-6" aria-hidden />}
              title="Nothing yet"
              description="Searches, answers and revealed contacts land here as you go."
            />
          ) : (
            <ul className="space-y-1.5 p-4">
              {entries.map((entry) => {
                const kind = KIND[entry.entity] ?? KIND.people;
                const Icon = kind.icon;
                return (
                  <li key={entry.id}>
                    <div className="surface-lit a-ring group flex items-start gap-2.5 rounded-xl p-3 transition hover:border-[var(--border-strong)]">
                      <span
                        className="tinted mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg"
                        style={{ '--tone': kind.tone } as React.CSSProperties}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>

                      <button
                        type="button"
                        onClick={() => router.push(`/contacts?reopen=${entry.id}`)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium">
                          {entry.label || 'Untitled search'}
                        </p>
                        {entry.answer && (
                          <p className="text-muted mt-0.5 line-clamp-2 text-xs leading-relaxed">
                            {entry.answer}
                          </p>
                        )}
                        <p className="text-subtle mt-1 flex flex-wrap items-center gap-x-2 text-[11px]">
                          <span>{ago(entry.created_at)}</span>
                          {entry.rows > 0 && (
                            <span className="numeric">
                              {entry.rows} {kind.word}
                              {entry.total != null && entry.total > entry.rows
                                ? ` of ${entry.total.toLocaleString('en-IN')}`
                                : ''}
                            </span>
                          )}
                          {/* Zero is not shown: a search that cost nothing is
                              the normal case, and a column of "0 credits" would
                              read as a meter rather than as a price. */}
                          {entry.credits > 0 && (
                            <span className="numeric inline-flex items-center gap-1">
                              <Coins className="size-3" aria-hidden />
                              {entry.credits}
                            </span>
                          )}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => void removeEntry(entry.id)}
                        aria-label={`Delete ${entry.label ?? 'entry'}`}
                        className="text-subtle shrink-0 rounded-md p-1 opacity-0 transition group-hover:opacity-100 hover:text-[var(--h-rose)] focus-visible:opacity-100"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* ── The working list ── */}
        <Section
          icon={<ListChecks className="size-4" aria-hidden />}
          title="List"
          note="Rows kept across searches and across both tabs, up to 500. Adding somebody twice keeps one row, and a row you have already revealed keeps what you paid for."
          tone="var(--h-emerald)"
          count={rows?.length}
        >
          {rows === null ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" aria-hidden />}
              title="Nothing on the list"
              description="Tick rows in the results and choose Add to list. They stay here while you run the next search."
            />
          ) : (
            <div className="space-y-5 p-4">
              {(
                [
                  ['people', people] as const,
                  ['companies', companies] as const,
                ] satisfies readonly (readonly [Entity, ListRow[]])[]
              ).map(([entity, group]) =>
                group.length === 0 ? null : (
                  <div key={entity}>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="a-label">
                        {group.length} {entity === 'companies' ? 'companies' : 'people'}
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
                        className="text-muted inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
                      >
                        <Download className="size-3.5" aria-hidden />
                        Export these
                      </button>
                    </div>

                    <ul className="space-y-1">
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

                        return (
                          <li
                            key={entry.dedupe_key}
                            className="surface-lit a-ring group flex items-center gap-2.5 rounded-xl px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{primary}</p>
                              {secondary && (
                                <p className="text-subtle truncate text-xs">{secondary}</p>
                              )}
                            </div>
                            {row.enriched === true && (
                              <span
                                className="tinted shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                                style={{ '--tone': 'var(--h-emerald)' } as React.CSSProperties}
                              >
                                revealed
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => void removeRow(entry)}
                              aria-label={`Remove ${primary}`}
                              className="text-subtle shrink-0 rounded-md p-1 opacity-0 transition group-hover:opacity-100 hover:text-[var(--h-rose)] focus-visible:opacity-100"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

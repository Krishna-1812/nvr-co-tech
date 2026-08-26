'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Clock,
  Coins,
  Download,
  MessageSquare,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { Entity } from './filters';
import type { Row } from './store';

/**
 * The two panels that make this a workspace rather than a search box.
 *
 * **History** is how a result set is not paid for twice. A company search costs
 * a credit a page and a revealed contact costs one each, so getting back to
 * something already bought has to be free and obvious.
 *
 * **The working list** is how several searches feed one outcome. Without it
 * every search discards the last: you can tick, reveal and export, but only
 * inside a single result set. Both live on the server rather than in the
 * browser, because both can hold contact details that cost real money and a
 * closed tab must not throw away a purchase.
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

// ─── History ─────────────────────────────────────────────────────────────────

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

/** What each kind of entry is, in a word and a mark. */
const KIND: Readonly<Record<string, { icon: typeof Users; word: string; tone: string }>> = {
  people: { icon: Users, word: 'people', tone: 'var(--h-indigo)' },
  companies: { icon: Building2, word: 'companies', tone: 'var(--h-cyan)' },
  chat: { icon: MessageSquare, word: 'answer', tone: 'var(--h-violet)' },
  contact: { icon: Sparkles, word: 'contact', tone: 'var(--h-amber)' },
  company_profile: { icon: Building2, word: 'profile', tone: 'var(--h-amber)' },
  revealed: { icon: Sparkles, word: 'revealed', tone: 'var(--h-emerald)' },
};

export function HistoryDrawer({
  open,
  onClose,
  onReopen,
}: {
  open: boolean;
  onClose: () => void;
  onReopen: (id: number) => void;
}) {
  const [entries, setEntries] = useState<HistoryItem[] | null>(null);

  /*
   * Reopening does not blank the list first. The skeleton belongs to the first
   * open, when there is genuinely nothing to show; on every open after that the
   * previous entries are still true, and clearing them to draw a loading state
   * over the top makes a panel that is already correct flicker on its way to
   * being correct again.
   */
  useEffect(() => {
    if (!open) return;
    let live = true;
    void fetch('/api/finder/history')
      .then((r) => r.json() as Promise<{ entries?: HistoryItem[] }>)
      .then((d) => {
        if (live) setEntries(d.entries ?? []);
      })
      .catch(() => {
        if (live) setEntries([]);
      });
    return () => {
      live = false;
    };
  }, [open]);

  const remove = async (id: number) => {
    setEntries((prev) => (prev ?? []).filter((e) => e.id !== id));
    await fetch(`/api/finder/history/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="What you have looked up"
      header={
        <p className="text-subtle mt-1.5 text-xs leading-relaxed">
          Kept for 90 days, then retired. Reopening one costs nothing — that is the point of it
          being here.
        </p>
      }
    >
      {entries === null ? (
        <div className="space-y-2">
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
        <ul className="space-y-1.5">
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
                    onClick={() => onReopen(entry.id)}
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
                      {/* Zero is not shown: a search that cost nothing is the
                          normal case, and a column of "0 credits" would read as
                          a meter rather than as a price. */}
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
                    onClick={() => void remove(entry.id)}
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
    </Drawer>
  );
}

// ─── The working list ────────────────────────────────────────────────────────

export type ListRow = { entity: string; dedupe_key: string; row: Row; added_at: string };

export function ListDrawer({
  open,
  onClose,
  onCount,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  onCount: (n: number) => void;
  onExport: (entity: Entity, rows: Row[]) => void;
}) {
  const [rows, setRows] = useState<ListRow[] | null>(null);

  // Same as the history drawer: the skeleton is for the first open only.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void fetch('/api/finder/list')
      .then((r) => r.json() as Promise<{ rows?: ListRow[] }>)
      .then((d) => {
        if (!live) return;
        setRows(d.rows ?? []);
        onCount((d.rows ?? []).length);
      })
      .catch(() => {
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, [open, onCount]);

  const remove = async (entry: ListRow) => {
    const next = (rows ?? []).filter((r) => r.dedupe_key !== entry.dedupe_key);
    setRows(next);
    onCount(next.length);
    await fetch(
      `/api/finder/list?entity=${encodeURIComponent(entry.entity)}&key=${encodeURIComponent(entry.dedupe_key)}`,
      { method: 'DELETE' },
    ).catch(() => {});
  };

  const people = (rows ?? []).filter((r) => r.entity !== 'companies');
  const companies = (rows ?? []).filter((r) => r.entity === 'companies');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Your working list"
      width="lg"
      header={
        <p className="text-subtle mt-1.5 text-xs leading-relaxed">
          Rows kept across searches and across both tabs, up to 500. Adding somebody twice keeps one
          row, and a row you have already revealed keeps what you paid for.
        </p>
      }
    >
      {rows === null ? (
        <div className="space-y-2">
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
        <div className="space-y-5">
          {(
            [
              ['people', people] as const,
              ['companies', companies] as const,
            ] satisfies readonly (readonly [Entity, ListRow[]])[]
          ).map(([entity, group]) =>
            group.length === 0 ? null : (
              <section key={entity}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="a-label">
                    {group.length} {entity === 'companies' ? 'companies' : 'people'}
                  </p>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => onExport(entity, group.map((g) => g.row))}
                    className="text-muted inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition hover:border-[var(--border-strong)]"
                  >
                    <Download className="size-3.5" aria-hidden />
                    Export these
                  </button>
                </div>

                <ul className="space-y-1">
                  {group.map((entry) => {
                    const row = entry.row ?? {};
                    const primary =
                      s(row.full_name) || s(row.name) || s(row.primary_domain) || 'Untitled row';
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
                          onClick={() => void remove(entry)}
                          aria-label={`Remove ${primary}`}
                          className="text-subtle shrink-0 rounded-md p-1 opacity-0 transition group-hover:opacity-100 hover:text-[var(--h-rose)] focus-visible:opacity-100"
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
    </Drawer>
  );
}

// ─── The spend line ──────────────────────────────────────────────────────────

/**
 * What this tool has spent, this month and today.
 *
 * Never called a balance and never showing a "remaining": no endpoint reachable
 * with this key reports the account total, and the same key funds other
 * features, so any such figure would be a guess. What the ledger knows exactly
 * is what Contact Finder spent.
 */
export function CreditLine({ watched }: { watched: number }) {
  const [spend, setSpend] = useState<{ month: number; today: number } | null>(null);

  useEffect(() => {
    let live = true;
    void fetch('/api/finder/credits')
      .then((r) => r.json() as Promise<{ month?: number; today?: number }>)
      .then((d) => {
        if (live) setSpend({ month: d.month ?? 0, today: d.today ?? 0 });
      })
      .catch(() => {});
    // Re-read whenever this page has watched more being spent, so the figure
    // does not sit a search behind what just happened.
    return () => {
      live = false;
    };
  }, [watched]);

  if (!spend) return null;

  return (
    <p className="text-subtle flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <Coins className="size-3.5" aria-hidden />
        <span className="numeric font-semibold text-[var(--text-muted)]">{spend.month}</span> spent
        this month
      </span>
      {spend.today > 0 && (
        <span>
          <span className="numeric font-semibold text-[var(--text-muted)]">{spend.today}</span> today
        </span>
      )}
      {watched > 0 && (
        <span className={cn('numeric')}>
          {watched} on this page
        </span>
      )}
    </p>
  );
}

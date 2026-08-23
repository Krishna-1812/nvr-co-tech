'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, Search } from 'lucide-react';
import type { Statistic } from '@/lib/comps/types';
import { STATISTICS } from '@/lib/comps/statistics';
import { cn } from '@/lib/utils';

/**
 * Choosing the subject and the statistic — the one control that decides the
 * whole screen.
 *
 * ── Why this is a searchable combobox, not a `<select>` ────────────────────
 *
 * The registry is meant to hold every public company it can reach — thousands
 * of them. A native `<select>` of a thousand names is the single worst thing on
 * the old desk: no search, no keyboard jump past the first letter, and on a
 * phone a scroll wheel through a company at a time. Typing three letters of a
 * name and pressing enter is the whole of the interaction people actually want,
 * so that is what this is.
 *
 * ── It stays a URL, the same as the old GET form did ───────────────────────
 *
 * A comparables schedule is something people send each other, so the screen has
 * to be linkable — its state cannot live only in a hook. Choosing a company or a
 * statistic navigates to `/comps?subject=…&stat=…`, which is the same address the
 * old form produced; the difference is only how you pick, not what a pick means.
 */

export function DeskControls({
  choices,
  subjectId,
  subjectName,
  statistic,
}: {
  choices: { id: string; name: string }[];
  subjectId: string;
  subjectName: string;
  statistic: Statistic;
}) {
  const router = useRouter();

  const go = (next: { subject?: string; stat?: Statistic }) => {
    const subject = next.subject ?? subjectId;
    const stat = next.stat ?? statistic;
    router.push(`/comps?subject=${subject}&stat=${stat}`);
  };

  return (
    <div className="surface-lit a-ring flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="a-label mb-1.5 px-1">Company to value</p>
        <SubjectCombobox
          choices={choices}
          subjectId={subjectId}
          subjectName={subjectName}
          onPick={(id) => go({ subject: id })}
        />
      </div>

      <div className="shrink-0">
        <p className="a-label mb-1.5 px-1">Peer statistic</p>
        <div
          role="radiogroup"
          aria-label="Statistic to apply across the peer set"
          className="surface-sunken flex rounded-xl border p-1"
        >
          {STATISTICS.map((s) => {
            const on = s.value === statistic;
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={on}
                title={s.label}
                onClick={() => go({ stat: s.value })}
                className={cn(
                  'relative rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  on
                    ? 'gradient-brand text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]'
                    : 'text-muted hover:text-[var(--text-c)]',
                )}
              >
                {s.short}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The subject picker itself.
 *
 * Matching is the same subsequence test the command palette uses — "hdfc" finds
 * "HDFC Bank", "reli" finds "Reliance Industries" — which is all a list of names
 * needs and is one function rather than a fuzzy-search dependency. The list is
 * capped as it renders so a registry of ten thousand names never mounts ten
 * thousand rows; the count of what is hidden is shown so the cap is honest.
 */
function SubjectCombobox({
  choices,
  subjectId,
  subjectName,
  onPick,
}: {
  choices: { id: string; name: string }[];
  subjectId: string;
  subjectName: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const CAP = 50;
  const { results, hidden } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return { results: choices.slice(0, CAP), hidden: Math.max(0, choices.length - CAP) };
    }
    const matches = (name: string) => {
      const hay = name.toLowerCase();
      let i = 0;
      for (const ch of q) {
        i = hay.indexOf(ch, i);
        if (i === -1) return false;
        i += 1;
      }
      return true;
    };
    const found = choices.filter((c) => matches(c.name));
    return { results: found.slice(0, CAP), hidden: Math.max(0, found.length - CAP) };
  }, [choices, query]);

  // Any change to the query invalidates where the cursor points — back to the top.
  const [cursorFor, setCursorFor] = useState(query);
  if (cursorFor !== query) {
    setCursorFor(query);
    setCursor(0);
  }

  // Close on an outside click, so the panel behaves like every other popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  // Focus the search box when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view under keyboard control.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor, results.length]);

  const pick = (id: string) => {
    setOpen(false);
    setQuery('');
    if (id !== subjectId) onPick(id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[cursor];
      if (chosen) pick(chosen.id);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition',
          'bg-[var(--surface-raised)] shadow-[var(--elev-1)]',
          'hover:border-[var(--border-strong)]',
          open && 'border-brand-500 ring-4 ring-brand-500/15',
        )}
      >
        <span className="gradient-brand grid size-8 shrink-0 place-items-center rounded-lg text-white">
          <Building2 className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-tight">
            {subjectName}
          </span>
        </span>
        <ChevronDown
          className={cn('text-subtle size-4 shrink-0 transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="a-ring animate-[pop_0.16s_cubic-bezier(0.34,1.56,0.64,1)] elev-4 absolute z-40 mt-2 flex max-h-[min(24rem,60vh)] w-full min-w-[18rem] flex-col overflow-hidden rounded-2xl border bg-[var(--surface-raised)]"
          onKeyDown={onKeyDown}
        >
          <span aria-hidden className="gradient-brand h-[3px] shrink-0" />
          <div className="flex shrink-0 items-center gap-2.5 border-b px-3.5 py-2.5">
            <Search className="text-subtle size-4 shrink-0" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a company name…"
              aria-label="Search companies"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-subtle)] lg:text-sm"
            />
          </div>

          <div ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {results.map((c, i) => {
              const on = i === cursor;
              const current = c.id === subjectId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={current}
                  data-active={on}
                  onPointerMove={() => setCursor(i)}
                  onClick={() => pick(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    on ? 'bg-[var(--surface-sunken)]' : 'hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  {current && (
                    <Check className="text-brand-500 size-4 shrink-0" aria-hidden />
                  )}
                </button>
              );
            })}

            {results.length === 0 && (
              <p className="text-subtle px-3 py-8 text-center text-sm">
                No company matches “{query.trim()}”.
              </p>
            )}

            {hidden > 0 && (
              <p className="text-subtle px-3 py-2 text-center text-xs">
                {hidden.toLocaleString('en-IN')} more — keep typing to narrow the list.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

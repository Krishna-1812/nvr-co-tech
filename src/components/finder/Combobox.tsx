'use client';

import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The one picker, for all five vocabularies.
 *
 * ── Why a picker at all ────────────────────────────────────────────────────
 *
 * Because three of these vocabularies are closed and Apollo will not tell you
 * what is in them. An invented technology uid returns zero. An invented place
 * returns zero. A misspelled real place still returns 826 rows, because Apollo
 * recovers from a typo in one component — so a wrong value fails
 * *unpredictably*: sometimes silently empty, sometimes silently wider. Neither
 * is an error anybody can catch by reading the screen.
 *
 * ── Typing is never blocked ────────────────────────────────────────────────
 *
 * An unlisted value is still a legitimate search, and the list is not
 * exhaustive — it grows from what Apollo actually returns. So the picker
 * suggests and never refuses. The two code vocabularies are the exception,
 * because Apollo enforces their shape and rejects anything else outright, and
 * there the format is checked here for an immediate answer as well as on the
 * server, which is the guard that counts.
 *
 * `confirmed` marks a value that has actually been seen on a real Apollo record.
 * A seeded value nobody has ever seen returned is a guess this codebase made,
 * and saying which is which is the difference between a list and a promise.
 */

export type Entry = {
  value: string;
  kind: string;
  confirmed: boolean;
  covers: string[];
  note?: string;
};

const FORMATS: Record<string, { re: RegExp; hint: string }> = {
  naics: {
    re: /^[0-9]{2,5}$/,
    hint: 'NAICS codes are 2 to 5 digits here. Official codes are 6 digits, so drop the last one or two: 541511 becomes 54151.',
  },
  sic: { re: /^[0-9]{4}$/, hint: 'SIC codes are exactly 4 digits.' },
};

/**
 * Suggestions cached per vocabulary and query, so retyping is instant.
 *
 * Module-scoped rather than component state, because the same picker is mounted
 * and unmounted repeatedly as the panel opens and closes, and a cache that died
 * with the component would refetch the same list every time.
 */
const CACHE = new Map<string, { entries: Entry[]; truncated: boolean }>();

export function Combobox({
  vocab,
  values,
  onChange,
  placeholder,
  label,
}: {
  vocab: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  /*
   * The cache is the source of truth and it lives outside React, so a fetch
   * landing is announced rather than copied into state. Copying it would mean
   * two places to read the same list from, and the effect writing to state on a
   * cache HIT is a cascading render for no new information.
   */
  const [, announce] = useReducer((n: number) => n + 1, 0);

  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const cacheKey = `${vocab}:${query.trim().toLowerCase()}`;
  const cached = CACHE.get(cacheKey);
  const truncated = cached?.truncated ?? false;
  // Memoised on the cache entry itself rather than derived with `??`, so an
  // absent entry does not hand a fresh empty array to the filter below on every
  // render and invalidate it.
  const entries = useMemo(() => cached?.entries ?? [], [cached]);

  useEffect(() => {
    if (!open || CACHE.has(cacheKey)) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const [kind, q] = [cacheKey.slice(0, cacheKey.indexOf(':')), cacheKey.slice(cacheKey.indexOf(':') + 1)];
        const url = `/api/finder/vocab?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { entries?: Entry[]; truncated?: boolean };
        CACHE.set(cacheKey, { entries: data.entries ?? [], truncated: Boolean(data.truncated) });
        announce();
      } catch {
        /* An unreachable picker is a picker with no suggestions, not an error
           worth putting on screen: typing still works and still searches. */
      }
    }, 140);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, cacheKey]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const shown = useMemo(() => entries.filter((e) => !values.includes(e.value)), [entries, values]);

  const commit = (value: string) => {
    const v = value.trim();
    if (!v) return;

    const format = FORMATS[vocab];
    if (format && !format.re.test(v)) {
      setRejection(format.hint);
      return;
    }

    setRejection(null);
    if (!values.includes(v)) onChange([...values, v]);
    setQuery('');
    setCursor(0);
  };

  const remove = (value: string) => onChange(values.filter((v) => v !== value));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'Backspace' && !query && values.length > 0) {
      remove(values[values.length - 1]);
      return;
    }
    if (e.key === 'ArrowDown' && shown.length > 0) {
      e.preventDefault();
      setCursor((c) => (c + 1) % shown.length);
    } else if (e.key === 'ArrowUp' && shown.length > 0) {
      e.preventDefault();
      setCursor((c) => (c - 1 + shown.length) % shown.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(open && shown[cursor] ? shown[cursor].value : query);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div
        className={cn(
          'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 transition',
          'bg-[var(--surface-raised)] shadow-[var(--elev-1)]',
          'hover:border-[var(--border-strong)]',
          open && 'border-brand-500 ring-4 ring-brand-500/15',
        )}
      >
        {values.map((v) => (
          <span
            key={v}
            className="surface-sunken inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium"
          >
            <span className="truncate">{v}</span>
            <button
              type="button"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
              className="text-subtle hover:text-[var(--text-c)]"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setRejection(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={values.length === 0 ? placeholder : ''}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-base outline-none placeholder:text-[var(--text-subtle)] lg:text-sm"
        />
      </div>

      {rejection && (
        <p className="mt-1 px-1 text-xs text-[var(--status-warn)]">{rejection}</p>
      )}

      {open && shown.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="a-ring elev-4 absolute z-40 mt-1.5 flex max-h-72 w-full min-w-[19rem] flex-col overflow-hidden rounded-xl border bg-[var(--surface-raised)] animate-[pop_0.14s_cubic-bezier(0.34,1.56,0.64,1)]"
        >
          <span aria-hidden className="gradient-brand h-[2px] shrink-0" />
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {shown.map((entry, i) => (
              <button
                key={`${entry.kind}:${entry.value}`}
                type="button"
                role="option"
                aria-selected={i === cursor}
                onPointerMove={() => setCursor(i)}
                onClick={() => commit(entry.value)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                  i === cursor ? 'bg-[var(--surface-sunken)]' : 'hover:bg-[var(--surface-sunken)]',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{entry.value}</span>
                    {entry.kind === 'family' && (
                      <span className="a-label shrink-0 !text-[9px]">group</span>
                    )}
                    {entry.confirmed && (
                      <Check
                        className="size-3 shrink-0 text-[var(--h-emerald)]"
                        aria-label="Seen on a real record"
                      />
                    )}
                  </span>
                  {entry.note && (
                    <span className="text-subtle mt-0.5 block truncate text-xs">{entry.note}</span>
                  )}
                  {/* A family is several real values. Naming them is what stops
                      the picker implying Apollo holds a value spelled "healthcare". */}
                  {entry.covers.length > 0 && (
                    <span className="text-subtle mt-0.5 block truncate text-xs">
                      {entry.covers.slice(0, 4).join(', ')}
                      {entry.covers.length > 4 && ` and ${entry.covers.length - 4} more`}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {truncated && (
            <p className="text-subtle border-t px-3 py-1.5 text-center text-xs">
              Keep typing to narrow this list.
            </p>
          )}
        </div>
      )}

      {open && shown.length === 0 && query.trim() && (
        <div className="a-ring elev-4 absolute z-40 mt-1.5 w-full rounded-xl border bg-[var(--surface-raised)] px-3 py-2.5">
          <p className="text-subtle text-xs">
            Nothing listed matches. Press enter to search for it anyway.
          </p>
        </div>
      )}
    </div>
  );
}

/** The magnifier the panel puts beside a plain text filter. */
export function SearchIcon() {
  return <Search className="text-subtle size-4 shrink-0" aria-hidden />;
}

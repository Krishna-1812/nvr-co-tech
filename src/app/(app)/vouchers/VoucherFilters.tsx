'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input, Select } from '@/components/ui/primitives';

/**
 * Filters push straight into the URL, so a filtered view is shareable and
 * survives a refresh or a back button. v1 had no filtering at all.
 */
export function VoucherFilters({
  chapters,
  statuses,
}: {
  chapters: { id: string; name: string }[];
  statuses: { value: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const first = useRef(true);

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page'); // any filter change resets to page 1
    router.push(`/vouchers?${next}`);
  };

  // Debounce the search box so typing doesn't fire a navigation per keystroke.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => apply({ q }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = params.get('status') ?? '';
  const chapter = params.get('chapter') ?? '';
  const query = params.get('q') ?? '';

  /*
   * What is currently narrowing the list, spelled out. Two selects sitting on
   * "Approved" and "Indore" state that too, but only if you look at them; a row
   * of chips is the thing you notice when a colleague sends you a filtered link
   * and the register looks emptier than you expected.
   */
  const chips = [
    // Emptying the box is enough — the debounce below turns it into a navigation,
    // and clearing the URL here as well would push the same history entry twice.
    query && { key: 'q', label: `“${query}”`, clear: () => setQ('') },
    status && {
      key: 'status',
      label: statuses.find((s) => s.value === status)?.label ?? status,
      clear: () => apply({ status: '' }),
    },
    chapter && {
      key: 'chapter',
      label: chapters.find((c) => c.id === chapter)?.name ?? 'Chapter',
      clear: () => apply({ chapter: '' }),
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div className="surface-lit rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search voucher no., payee, invoice, event…"
            className="pl-9"
            type="search"
            aria-label="Search vouchers"
          />
        </div>

        <Select
          value={status}
          onChange={(e) => apply({ status: e.target.value })}
          className="w-auto flex-1 sm:flex-none"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>

        <Select
          value={chapter}
          onChange={(e) => apply({ chapter: e.target.value })}
          className="w-auto flex-1 sm:flex-none"
          aria-label="Filter by chapter"
        >
          <option value="">All chapters</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-subtle text-[11px] font-semibold tracking-[0.06em] uppercase">
            Filtered by
          </span>
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={c.clear}
              className="surface-sunken text-muted inline-flex max-w-56 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
            >
              <span className="truncate">{c.label}</span>
              <X className="size-3 shrink-0" aria-hidden />
              <span className="sr-only">Remove this filter</span>
            </button>
          ))}
          <button
            onClick={() => {
              setQ('');
              router.push('/vouchers');
            }}
            className="text-muted ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

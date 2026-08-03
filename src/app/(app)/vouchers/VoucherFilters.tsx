'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { Search, X } from 'lucide-react';
import { Input, Select } from '@/components/ui/primitives';
import { STATUS_TONE } from '@/components/StatusBadge';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { cn } from '@/lib/utils';

/**
 * Filters push straight into the URL, so a filtered view is shareable and survives
 * a refresh or a back button. v1 had no filtering at all.
 *
 * Status is a row of pills rather than a dropdown. Six statuses, each with a colour
 * the rest of the app already uses, is a thing you can hit in one click and read
 * without opening — and the coloured dot on each pill is the same dot as the badge
 * on the rows it filters to, so the connection needs no explaining. A select hid
 * all of that behind a click and told you nothing until you opened it.
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
  const filtered = Boolean(query || status || chapter);

  return (
    <div className="surface-lit overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-2.5 p-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search voucher no., payee, invoice, event…"
            className="h-10 pl-9"
            type="search"
            aria-label="Search vouchers"
          />
        </div>

        <Select
          value={chapter}
          onChange={(e) => apply({ chapter: e.target.value })}
          className="h-10 w-auto flex-1 sm:flex-none"
          aria-label="Filter by chapter"
        >
          <option value="">All chapters</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        {filtered && (
          <button
            onClick={() => {
              setQ('');
              router.push('/vouchers');
            }}
            className="text-muted inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
          >
            <X className="size-3.5" aria-hidden />
            Clear all
          </button>
        )}
      </div>

      {/*
        Scrolls rather than wraps below sm. Seven pills wrapping to three rows
        makes the toolbar taller than the first row of the table it is filtering.
      */}
      <div className="scroll-x-hint flex gap-1.5 overflow-x-auto border-t px-3 py-2.5">
        <Pill active={!status} onClick={() => apply({ status: '' })}>
          All
        </Pill>
        {statuses.map((s) => (
          <Pill
            key={s.value}
            active={status === s.value}
            tone={STATUS_TONE[s.value as VoucherStatus]}
            onClick={() => apply({ status: status === s.value ? '' : s.value })}
          >
            {s.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}

/**
 * One status filter. The active pill is tinted by its own status colour rather
 * than by the brand, so which filter is on is legible from the colour alone —
 * and it matches the rows it produces.
 */
function Pill({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={tone ? ({ '--tone': tone } as CSSProperties) : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition',
        active && tone
          ? 'tinted font-semibold'
          : active
            ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
            : 'text-muted border-transparent hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]',
      )}
    >
      {tone && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: tone, opacity: active ? 1 : 0.55 }}
        />
      )}
      {children}
    </button>
  );
}

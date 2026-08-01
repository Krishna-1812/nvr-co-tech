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

  const active = params.get('status') || params.get('chapter') || params.get('q');

  return (
    <div className="flex flex-wrap items-center gap-3">
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
          aria-label="Search vouchers"
        />
      </div>

      <Select
        value={params.get('status') ?? ''}
        onChange={(e) => apply({ status: e.target.value })}
        className="w-auto"
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
        value={params.get('chapter') ?? ''}
        onChange={(e) => apply({ chapter: e.target.value })}
        className="w-auto"
        aria-label="Filter by chapter"
      >
        <option value="">All chapters</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      {active && (
        <button
          onClick={() => {
            setQ('');
            router.push('/vouchers');
          }}
          className="text-muted inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition hover:bg-[var(--surface-sunken)]"
        >
          <X className="size-4" aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}

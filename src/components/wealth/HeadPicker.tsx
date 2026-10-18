'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/primitives';
import { ASSET_HEADS, LIABILITY_HEADS, type HeadId, type HeadSpec, type Side } from '@/lib/wealth/heads';
import { HeadTile } from './shared';

/**
 * Choosing what kind of thing to add.
 *
 * Every head with its plain-language examples, and a box to type into, because
 * the fastest way to find where a Sukanya Samriddhi account goes is to type
 * "sukanya" rather than to know it lives under "Provident fund, PPF & NPS".
 * The search reads names, examples and the kinds inside each head.
 */
export function HeadPicker({
  open,
  side,
  onPick,
  onClose,
}: {
  open: boolean;
  side: Side;
  onPick: (id: HeadId) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const heads = side === 'asset' ? ASSET_HEADS : LIABILITY_HEADS;
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return heads;
    const hay = (h: HeadSpec) => `${h.name} ${h.examples} ${h.kinds.join(' ')} ${h.one}`.toLowerCase();
    return heads.filter((h) => words.every((w) => hay(h).includes(w)));
  }, [q, heads]);

  return (
    <Drawer
      open={open}
      onClose={() => {
        setQ('');
        onClose();
      }}
      title={side === 'asset' ? 'Add something you own' : 'Add something you owe'}
      header={
        <div className="relative mt-3">
          <Search aria-hidden className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={side === 'asset' ? 'Type what it is: PPF, gold, flat, SIP…' : 'Type what it is: car loan, credit card…'}
            aria-label="Search"
            className="pl-9"
          />
        </div>
      }
    >
      <ul className="-mx-2 space-y-1">
        {shown.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => {
                setQ('');
                onPick(h.id);
              }}
              className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[var(--surface-sunken)]"
            >
              <HeadTile id={h.id} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{h.name}</span>
                <span className="text-muted block text-[12.5px] leading-snug">{h.examples}</span>
              </span>
              <ChevronRight className="text-subtle size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="text-muted px-2 py-6 text-center text-sm">
            Nothing matches “{q}”. It probably fits under{' '}
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => onPick(side === 'asset' ? 'other_asset' : 'other_liability')}>
              {side === 'asset' ? 'Other assets' : 'Other dues'}
            </button>
            .
          </li>
        )}
      </ul>
    </Drawer>
  );
}

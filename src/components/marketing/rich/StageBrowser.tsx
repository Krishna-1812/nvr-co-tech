'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type BrowserItem = { key: string; group: string; node: React.ReactNode };

/**
 * A row of filter chips with one pill sliding under the chosen one, over a grid
 * that deals its cards back in each time the choice changes. The cards are
 * rendered on the server and handed in as nodes, so every one of them is in the
 * HTML as a link whether or not a filter is ever used.
 *
 * With only one group there is nothing to filter, and "All 7 · Live 7" would
 * be two chips saying the same thing, so the chips go and that group's note
 * stays.
 */
export function StageBrowser({
  items,
  groups,
  notes,
  label,
  className,
}: {
  items: BrowserItem[];
  /** The chips after "All", in order. Only groups with items are shown. */
  groups: string[];
  /** A sentence under the chips for each group, if it has one. */
  notes?: Record<string, string>;
  label: string;
  className?: string;
}) {
  const shown = groups.filter((g) => items.some((i) => i.group === g));
  const chips = ['All', ...shown];
  const filterable = shown.length > 1;
  const [group, setGroup] = useState('All');
  const visible = group === 'All' ? items : items.filter((i) => i.group === group);

  const bar = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const place = () => {
      const el = bar.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [group]);

  const note = notes?.[filterable ? group : shown[0]];

  return (
    <div>
      {filterable && (
      <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
        <div ref={bar} role="group" aria-label={label} className="g-chips relative inline-flex gap-1 rounded-full border border-[var(--m-line)] bg-[var(--m-card)] p-1.5">
          <span
            aria-hidden
            className="g-chip-pill"
            style={{ '--px': `${pill.x}px`, '--pw': `${pill.w}px`, top: 6, height: 'calc(100% - 12px)' } as React.CSSProperties}
          />
          {chips.map((c) => {
            const count = c === 'All' ? items.length : items.filter((i) => i.group === c).length;
            const on = c === group;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setGroup(c)}
                className={cn(
                  'relative z-10 whitespace-nowrap rounded-full px-4 py-2 t-3 font-medium transition-colors duration-300',
                  on ? 'text-[var(--m-on-grad)]' : 'text-[var(--m-dim)] hover:text-[var(--m-ink)]',
                )}
              >
                {c}
                <span className={cn('ml-1.5 tabular-nums', on ? 'opacity-70' : 'opacity-50')}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      )}
      {note && (
        <p key={`n-${group}`} className={cn('g-card-in m-dim max-w-2xl t-3', filterable && 'mt-5')}>
          {note}
        </p>
      )}
      <ul key={group} className={cn('mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {visible.map((item, i) => (
          <li key={item.key} className="g-card-in h-full" style={{ '--d': `${i * 60}ms` } as React.CSSProperties}>
            {item.node}
          </li>
        ))}
      </ul>
    </div>
  );
}

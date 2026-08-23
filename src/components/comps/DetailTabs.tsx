'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The working behind the headline, folded into one card.
 *
 * The old desk stacked the peer table, the rejects and the method notes as three
 * separate full-width cards, so reaching the exclusions meant scrolling past a
 * table that scrolls sideways. They are the same kind of thing — the evidence for
 * the number up top — so they belong under one set of tabs, with the peer set
 * open first because it is what a reader checks before anything else.
 *
 * The content is rendered on the server and handed in; this component only
 * decides which pane is shown, so the table keeps its server-side data and this
 * stays a thin toggle.
 */
export function DetailTabs({
  tabs,
}: {
  tabs: { id: string; label: string; badge?: number; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="surface-lit a-ring overflow-hidden rounded-2xl">
      <div
        role="tablist"
        aria-label="Peer set detail"
        className="scroll-x-hint flex gap-1 overflow-x-auto border-b p-2"
      >
        {tabs.map((tab) => {
          const on = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition',
                on
                  ? 'bg-[var(--surface-sunken)] text-[var(--text-c)] shadow-[var(--elev-1)]'
                  : 'text-muted hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]',
              )}
            >
              {on && (
                <span aria-hidden className="gradient-brand h-4 w-[3px] rounded-full" />
              )}
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="surface-raised text-subtle rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="animate-[fade_0.3s_ease-out]">
        {current?.content}
      </div>
    </div>
  );
}

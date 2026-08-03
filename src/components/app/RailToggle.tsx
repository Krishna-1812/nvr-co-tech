'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { setRailCollapsed, useRailCollapsed } from '@/lib/rail';

/** Collapses the rail to icons. All the reasoning lives in lib/rail.ts. */
export function RailToggle() {
  const collapsed = useRailCollapsed();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? 'Expand the sidebar' : 'Collapse the sidebar';

  return (
    <button
      type="button"
      onClick={() => setRailCollapsed(!collapsed)}
      aria-pressed={collapsed}
      title={label}
      className="text-subtle grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
}

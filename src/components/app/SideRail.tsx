import Link from 'next/link';
import { LayoutGrid, Plus } from 'lucide-react';
import type { NavItem } from '@/lib/nav';
import type { Fiscal } from '@/lib/fiscal';
import { BRAND } from '@/lib/marketing/content';
import { LogoMark } from '../marketing/Logo';
import { NavLink } from '../NavLink';
import { buttonClass } from '../ui/primitives';
import { RailToggle } from './RailToggle';

/**
 * The desktop rail.
 *
 * A left rail rather than the row of tabs this app used to have, because the app
 * has outgrown a row: five destinations, a queue count that has to be visible
 * from any screen, and a primary action that should not be competing with them
 * for horizontal space. A rail also gives the register the full width of the
 * window, which is the screen that most needs it.
 *
 * Collapsing is handled entirely in CSS from `data-rail` on <html> — see
 * RailToggle. Nothing in here re-renders when the rail narrows.
 */
export function SideRail({ nav, fiscal }: { nav: NavItem[]; fiscal: Fiscal }) {
  return (
    <aside
      aria-label="Sections"
      className="a-glass fixed inset-y-0 left-0 z-40 hidden w-[var(--a-rail)] flex-col border-r transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex"
    >
      {/* ── Brand, and the way back up to the workspace ── */}
      <div className="a-rail-item flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Link href="/dashboard" className="group flex min-w-0 items-center gap-2.5">
          <LogoMark
            id="rail-mark"
            className="size-8 shrink-0 transition group-hover:brightness-110"
          />
          <span className="a-rail-wide min-w-0 leading-none">
            <span className="block truncate text-[13.5px] font-semibold tracking-tight">
              Voucher Desk
            </span>
            <span className="text-subtle mt-1 block truncate text-[10px]">{BRAND.name}</span>
          </span>
        </Link>

        {/*
          Voucher Desk is one tool inside the platform, so there has to be a door
          back out of it. Wide only: at 4.75rem the mark itself is the only thing
          that fits, and the account menu carries the same destination at every
          width for that reason.
        */}
        <Link
          href="/hub"
          title="All solutions"
          className="a-rail-wide text-subtle ml-auto grid size-7 shrink-0 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
        >
          <LayoutGrid className="size-[15px]" aria-hidden />
          <span className="sr-only">All solutions</span>
        </Link>
      </div>

      {/* ── Primary action ── */}
      <div className="a-rail-item px-3 pt-4">
        <Link
          href="/vouchers/new"
          title="New voucher"
          className={buttonClass({
            variant: 'primary',
            size: 'sm',
            className: 'group h-9 w-full [[data-rail=collapsed]_&]:size-9 [[data-rail=collapsed]_&]:px-0',
          })}
        >
          <Plus className="size-4 shrink-0 transition-transform group-hover:rotate-90" aria-hidden />
          <span className="a-rail-wide">New voucher</span>
        </Link>
      </div>

      {/* ── Destinations ── */}
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={<item.icon className="size-4" aria-hidden />}
            badge={item.badge}
            exact={item.href === '/admin'}
          />
        ))}
      </nav>

      {/* ── Where we are in the year ── */}
      <div className="shrink-0 border-t p-3">
        <FiscalMeter fiscal={fiscal} />
        <div className="a-rail-item mt-2 flex items-center justify-between gap-2">
          <p className="a-rail-wide text-subtle truncate text-[10px]">
            {BRAND.firm}
          </p>
          <RailToggle />
        </div>
      </div>
    </aside>
  );
}

/**
 * How far through the financial year we are.
 *
 * Not decoration: the year is the unit this firm's work is measured in, every
 * voucher number carries it, and "how long is left" is a question somebody in
 * this app asks weekly. A four-pixel bar answers it without being asked.
 */
function FiscalMeter({ fiscal }: { fiscal: Fiscal }) {
  return (
    <div className="a-rail-wide">
      <div className="flex items-baseline justify-between gap-2">
        <span className="a-label">FY {fiscal.label}</span>
        <span className="text-subtle numeric text-[10px]">{fiscal.daysLeft}d left</span>
      </div>
      <div className="a-track relative mt-2 h-1 overflow-hidden rounded-full">
        <span
          className="a-fill gradient-brand absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${fiscal.progress}%` }}
        />
      </div>
    </div>
  );
}

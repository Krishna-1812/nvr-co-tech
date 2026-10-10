import Link from 'next/link';
import type { Section } from '@/lib/nav';
import type { Fiscal } from '@/lib/fiscal';
import { BRAND } from '@/lib/marketing/content';
import { LogoMark } from '../marketing/Logo';
import { NavLink } from '../NavLink';
import { buttonClass } from '../ui/primitives';
import { RailToggle } from './RailToggle';

/**
 * The desktop rail.
 *
 * A left rail rather than the row of tabs this app used to have, because it has
 * outgrown a row: several destinations, a queue count that has to be visible
 * from any screen, and a primary action that should not be competing with them
 * for horizontal space. A rail also gives a wide table the full width of the
 * window, which is the screen that most needs it.
 *
 * Everything specific to a tool — its name, its front door, its one important
 * button and where it can go — arrives in the Section. The rail itself is the
 * same object in every tool, which is the point.
 *
 * Collapsing is handled entirely in CSS from `data-rail` on <html>, see
 * RailToggle. Nothing in here re-renders when the rail narrows.
 */
export function SideRail({ section, fiscal }: { section: Section; fiscal: Fiscal }) {
  const Primary = section.primary?.icon;

  return (
    <aside
      aria-label="Sections"
      className="a-glass fixed inset-y-0 left-0 z-40 hidden w-[var(--a-rail)] flex-col border-r transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex"
    >
      {/*
        ── Brand ──
        The door back out to the workspace used to be a second, smaller link in
        here, and it only appeared while the rail was wide. That job now belongs
        to the breadcrumb in the top bar, which is on screen at every width and
        says what it leads to. Two doors to the hub within forty pixels of each
        other was one too many.
      */}
      <div className="a-rail-item flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Link href={section.home} className="group flex min-w-0 items-center gap-2.5">
          <LogoMark
            id="rail-mark"
            className="size-8 shrink-0 transition group-hover:brightness-110"
          />
          <span className="a-rail-wide min-w-0 leading-none">
            <span className="block truncate text-[13.5px] font-semibold tracking-tight">
              {section.name}
            </span>
            <span className="text-subtle mt-1 block truncate text-[10px]">{BRAND.name}</span>
          </span>
        </Link>
      </div>

      {/* ── Primary action ── */}
      {section.primary && Primary && (
        <div className="a-rail-item px-3 pt-4">
          <Link
            href={section.primary.href}
            title={section.primary.label}
            className={buttonClass({
              variant: 'primary',
              size: 'sm',
              className:
                'group h-9 w-full [[data-rail=collapsed]_&]:size-9 [[data-rail=collapsed]_&]:px-0',
            })}
          >
            <Primary
              className="size-4 shrink-0 transition-transform group-hover:rotate-90"
              aria-hidden
            />
            <span className="a-rail-wide truncate">{section.primary.label}</span>
          </Link>
        </div>
      )}

      {/* ── Destinations ── */}
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {section.items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={<item.icon className="size-4" aria-hidden />}
            badge={item.badge}
            // Two destinations that are prefixes of each other need the parent
            // pinned to an exact match, or it stays lit inside the child. Which
            // ones nest is declared on the section, not guessed at here.
            exact={item.exact}
          />
        ))}
      </nav>

      {/* ── Where we are in the year ── */}
      <div className="shrink-0 border-t p-3">
        <FiscalMeter fiscal={fiscal} />
        {/* The platform name is already on the mark at the top of the rail, so the
            foot of it is just the collapse control. */}
        <div className="a-rail-item mt-2 flex items-center justify-end gap-2">
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
 * voucher number carries it, a reconciliation is filed under it, and "how long is
 * left" is a question somebody in this app asks weekly. A four-pixel bar answers
 * it without being asked.
 */
/** A quadratic arc from the April horizon to the March one, peaking mid-year. */
const ARC = 'M8 46 Q110 -22 212 46';

/**
 * Where on ARC a share of its *length* falls. The terracotta stroke is cut by
 * length (pathLength 100), and a Bézier's parameter does not run at constant
 * speed, so placing the sun by parameter left it short of the stroke's end
 * everywhere but the middle of the year.
 */
function pointAlongArc(share: number) {
  const at = (t: number) => ({ x: 8 + 204 * t, y: 46 - 136 * t * (1 - t) });
  const steps = 120;
  const points = Array.from({ length: steps + 1 }, (_, i) => at(i / steps));
  const lengths = [0];
  for (let i = 1; i <= steps; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const target = Math.min(1, Math.max(0, share)) * lengths[steps];
  const i = Math.max(1, lengths.findIndex((l) => l >= target));
  const f = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  return {
    x: points[i - 1].x + (points[i].x - points[i - 1].x) * f,
    y: points[i - 1].y + (points[i].y - points[i - 1].y) * f,
  };
}

function FiscalMeter({ fiscal }: { fiscal: Fiscal }) {
  const sun = pointAlongArc(fiscal.progress / 100);
  return (
    <div className="a-rail-wide">
      <div className="flex items-baseline justify-between gap-2">
        <span className="a-label">FY {fiscal.label}</span>
        <span className="text-subtle numeric text-[10px]">{fiscal.daysLeft}d left</span>
      </div>
      {/* The year as the sun's path across the sky: April rises on the left,
          March sets on the right, and the sun stands where today is. The arc
          travelled is in terracotta; the rest of the year is still to come. */}
      <svg viewBox="0 0 220 50" className="mt-1.5 block h-auto w-full overflow-visible" aria-hidden>
        <path d="M2 46 H218" stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2 3" />
        <path d={ARC} fill="none" stroke="var(--a-track)" strokeWidth="3" strokeLinecap="round" />
        <path
          d={ARC}
          fill="none"
          stroke="var(--lc-carry)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${fiscal.progress} 100`}
        />
        <circle cx={sun.x} cy={sun.y} r="10" fill="var(--scene-sun)" opacity="0.25" />
        <circle
          cx={sun.x}
          cy={sun.y}
          r="6"
          fill="var(--scene-sun)"
          stroke="var(--surface-raised)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Link2, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { accentFor, displayName, initialsFor, isRecentlyActive } from '@/lib/analytics/identity';
import { NUM } from './Figures';

/**
 * The roster: the vocabulary every "list of people" screen in this section is
 * assembled from.
 *
 * It is a real `<table>`, which is worth defending because it does not look like
 * one. Rows read as separate floating cards, achieved with `border-spacing` and
 * rounded outer cells rather than by abandoning table semantics for a grid of
 * divs. The reason is boring and decisive: these screens are read by people who
 * navigate by keyboard and screen reader, who search the page with the browser's
 * own find, and who occasionally select a block of rows and paste them into a
 * spreadsheet. All three of those work on a table and none of them work on a
 * pile of divs that resembles one.
 *
 * Every timestamp cell takes `now` as a prop rather than reading the clock. A
 * component that calls Date.now() during render produces one answer on the
 * server and a different one in the browser a moment later, which React reports
 * as a hydration mismatch. Passing the instant down from the page makes the two
 * renders agree, and makes these cells trivially testable.
 */

/* ── Identity ─────────────────────────────────────────────────────────────── */

export function Avatar({
  email,
  name,
  photo,
  lastSeen,
  now,
  size = 36,
}: {
  email: string;
  name?: string | null;
  photo?: string | null;
  /** Drives the presence dot. Omit entirely to render no dot at all. */
  lastSeen?: string | null;
  now?: number;
  size?: number;
}) {
  const accent = accentFor(email);
  const live = lastSeen !== undefined && isRecentlyActive(lastSeen, now);

  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- enrichment photos come from arbitrary third-party hosts, which the Image optimiser would have to be told about one by one.
        <img
          src={photo}
          alt=""
          width={size}
          height={size}
          className="size-full rounded-full border object-cover"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-full place-items-center rounded-full font-semibold text-white"
          style={{
            fontSize: Math.round(size * 0.36),
            background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 55%, black))`,
          }}
        >
          {initialsFor(name, email)}
        </span>
      )}

      {lastSeen !== undefined && (
        <span
          aria-hidden
          title={live ? 'Active in the last two days' : 'No activity in the last two days'}
          className={cn(
            'absolute -right-px -bottom-px block rounded-full ring-2 ring-[var(--surface-raised)]',
            live ? 'bg-[var(--h-emerald)]' : 'bg-[var(--text-subtle)]',
          )}
          style={{
            width: Math.max(8, Math.round(size * 0.26)),
            height: Math.max(8, Math.round(size * 0.26)),
            boxShadow: live ? '0 0 6px var(--h-emerald)' : undefined,
          }}
        />
      )}
    </span>
  );
}

export function PersonCell({
  email,
  name,
  photo,
  lastSeen,
  now,
  /** How many pre-signup pages we managed to link to this person. Omitted when none. */
  linked,
}: {
  email: string;
  name?: string | null;
  photo?: string | null;
  lastSeen?: string | null;
  now?: number;
  linked?: number;
}) {
  return (
    <span className="flex items-center gap-3">
      <Avatar email={email} name={name} photo={photo} lastSeen={lastSeen} now={now} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold">{displayName(name, email)}</span>
          {Boolean(linked) && (
            <span
              title={`${linked} page ${linked === 1 ? 'view' : 'views'} from before this person ever signed in, linked by their tracking cookie`}
              className="tinted inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-semibold"
              style={{ ['--tone' as string]: 'var(--h-cyan)' }}
            >
              <Link2 className="size-2.5" aria-hidden />
              {linked}
            </span>
          )}
        </span>
        <span className={cn(NUM, 'text-subtle block truncate text-[11px]')}>{email}</span>
      </span>
    </span>
  );
}

export function CompanyCell({ company }: { company: string | null }) {
  if (!company) return <span className="text-subtle">&mdash;</span>;

  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold text-white"
        style={{ background: accentFor(company) }}
      >
        {company[0]?.toUpperCase()}
      </span>
      <span className="truncate text-[12.5px]">{company}</span>
    </span>
  );
}

/* ── Figures inside cells ─────────────────────────────────────────────────── */

/**
 * A count, tinted by what it counts.
 *
 * Greyed at zero on purpose. A column of tinted chips where a third of them say
 * "0" spends colour on absence; dimming those makes the rows that actually did
 * something the ones the eye lands on.
 */
export function NumChip({
  value,
  tone,
  title,
}: {
  value: number;
  tone: string;
  title?: string;
}) {
  const empty = value === 0;

  return (
    <span
      title={title}
      style={{ ['--tone' as string]: empty ? 'var(--text-subtle)' : tone }}
      className={cn(
        NUM,
        'tinted inline-flex min-w-9 items-center justify-center rounded-full border px-2 py-[3px] text-[11.5px] font-semibold',
        empty && 'opacity-60',
      )}
    >
      {value.toLocaleString('en-IN')}
    </span>
  );
}

/**
 * A count with the same count drawn beside it.
 *
 * Used for exactly one column per table — page views — where the question is
 * never "how many" on its own but "how many compared with everyone else here".
 * The bar answers that at a glance; the number keeps it precise. Doing this to
 * every numeric column would turn the table into a chart and cost the
 * comparison its meaning.
 */
export function ChipWithBar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: string;
}) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <NumChip value={value} tone={tone} />
      <span className="a-track block h-[3px] w-14 overflow-hidden rounded-full">
        <span
          className="a-fill block h-full rounded-full"
          style={{ width: `${share * 100}%`, background: tone }}
        />
      </span>
    </span>
  );
}

/** Relative on top, exact underneath. Both, because each answers a different question. */
export function WhenCell({ iso, now }: { iso: string | null; now: number }) {
  if (!iso) return <span className="text-subtle">&mdash;</span>;

  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return <span className="text-subtle">&mdash;</span>;

  const minutes = Math.round((now - at.getTime()) / 60_000);
  const relative =
    minutes < 1
      ? 'just now'
      : minutes < 60
        ? `${minutes}m ago`
        : minutes < 1440
          ? `${Math.round(minutes / 60)}h ago`
          : `${Math.round(minutes / 1440)}d ago`;

  return (
    <span className="block leading-tight">
      <span className="block text-[12.5px] font-medium">{relative}</span>
      <span className={cn(NUM, 'text-subtle block text-[10.5px]')}>
        {at.toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        })}
      </span>
    </span>
  );
}

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;

/** Which of the three shapes a device string is describing. */
export function deviceKind(device: string | null | undefined): keyof typeof DEVICE_ICON {
  const d = (device ?? '').toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return 'mobile';
  if (d.includes('tablet') || d.includes('ipad')) return 'tablet';
  return 'desktop';
}

const DEVICE_TONE = {
  mobile: 'var(--h-emerald)',
  tablet: 'var(--h-amber)',
  desktop: 'var(--h-indigo)',
} as const;

export function DeviceCell({
  browser,
  os,
  device,
}: {
  browser?: string | null;
  os?: string | null;
  device?: string | null;
}) {
  const kind = deviceKind(device);
  const Icon = DEVICE_ICON[kind];
  const full = [browser, os, device].filter(Boolean).join(' · ') || 'Not recorded';

  return (
    <span className="flex items-center gap-2" title={full}>
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-md border"
        style={{
          color: DEVICE_TONE[kind],
          borderColor: `color-mix(in oklab, ${DEVICE_TONE[kind]} 28%, var(--border-c))`,
          background: `color-mix(in oklab, ${DEVICE_TONE[kind]} 10%, transparent)`,
        }}
      >
        <Icon className="size-3" />
      </span>
      <span className="text-subtle truncate text-[11.5px]">{browser || kind}</span>
    </span>
  );
}

/** A device as a bare tag, for the log tables that have no room for an icon. */
export function DeviceTag({ device }: { device?: string | null }) {
  const kind = deviceKind(device);
  return (
    <span
      style={{ ['--tone' as string]: DEVICE_TONE[kind] }}
      className="tinted inline-flex rounded-md border px-1.5 py-px text-[10.5px] font-semibold capitalize"
    >
      {kind}
    </span>
  );
}

export function SourcePill({ source }: { source: string | null }) {
  if (!source) return <span className="text-subtle">&mdash;</span>;

  return (
    <span
      style={{ ['--tone' as string]: 'var(--h-violet)' }}
      className="tinted inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full border px-2 py-[3px] text-[11px] font-medium"
      title={source}
    >
      <span aria-hidden>&#8599;</span>
      <span className="truncate">{source}</span>
    </span>
  );
}

/* ── The table shell ──────────────────────────────────────────────────────── */

/**
 * `border-spacing` is what makes the rows float, and it only applies with
 * `border-collapse: separate` — which is why that is set explicitly rather than
 * left to the browser's default of `collapse`.
 */
export function Roster({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="scroll-x-hint overflow-x-auto">
      <table
        className={cn('w-full min-w-[52rem] border-separate border-spacing-y-[6px] text-left', className)}
      >
        {children}
      </table>
    </div>
  );
}

export function RosterHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-[color-mix(in_oklab,var(--surface-raised)_82%,transparent)] backdrop-blur">
      <tr>{children}</tr>
    </thead>
  );
}

export function RosterTh({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'a-label border-b pb-2 whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

/**
 * One row, as a card.
 *
 * The accent bar is drawn as an inset box-shadow on the first cell rather than a
 * pseudo-element, so it cannot affect layout and cannot be clipped by the
 * rounded corner it sits inside.
 *
 * The stagger is capped: at 14ms a step, a 200-row table would otherwise still
 * be arriving nearly three seconds after it loaded. Capping the delay means long
 * tables land almost together and short ones still cascade.
 */
export function RosterRow({
  children,
  email,
  index,
  onClick,
}: {
  children: ReactNode;
  /** Drives the hover accent, so a row is the same colour as its own avatar. */
  email: string;
  index: number;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        ['--tone' as string]: accentFor(email),
        animationDelay: `${Math.min(index * 14, 420)}ms`,
      }}
      className={cn(
        'motion-safe:animate-[rise_0.4s_cubic-bezier(0.22,1,0.36,1)_backwards]',
        'group [&>td]:border-y [&>td]:bg-[var(--surface-raised)] [&>td]:px-3 [&>td]:py-2.5 [&>td]:align-middle',
        '[&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r',
        'transition-colors',
        onClick && 'a-ring cursor-pointer',
        'hover:[&>td]:bg-[color-mix(in_oklab,var(--tone)_6%,var(--surface-raised))]',
        // The focus cue for keyboard users, and the hover cue for everyone else.
        'hover:[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--tone)]',
        'focus-visible:[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--tone)]',
      )}
    >
      {children}
    </tr>
  );
}

export function RosterTd({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={cn(align === 'right' && 'text-right', className)}>{children}</td>
  );
}

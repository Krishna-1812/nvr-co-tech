'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { NUM } from './Figures';

/**
 * The journey timeline, and the chips that sit above it.
 *
 * One shape of event, used on every screen in this section, so that a person's
 * history reads the same whether you reached it from the staff page, a tenant's
 * page or the visitor page. The four kinds are fixed and their meanings do not
 * overlap:
 *
 *   view    a page view from before this person had any account       (cyan)
 *   signin  they signed in, or signed up                              (lime)
 *   post    a page view from after they had an account                (violet)
 *   run     they opened a metered tool                               (emerald)
 *
 * The distinction between `view` and `post` is the one that earns its keep. Both
 * are page views; what separates them is whether we knew who it was at the time.
 * A timeline that collapsed them into one kind would lose the single most useful
 * thing on it, which is the moment an anonymous reader became a known person.
 *
 * The array arrives already merged, sorted and capped by the server. This
 * component sorts nothing and fetches nothing — if the order looks wrong, the
 * aggregation is wrong, and that is deliberately the only place it can be wrong.
 */

export type EventKind = 'view' | 'signin' | 'post' | 'run';

export type JourneyEvent = {
  kind: EventKind;
  at: string;
  label: string;
  /** The dimmer second line: a URL, a duration, a tool name. */
  meta?: string | null;
};

const KIND = {
  view: { tone: 'var(--h-cyan)', glyph: '○', says: 'Before signing in' },
  signin: { tone: 'var(--h-lime)', glyph: '★', says: 'Signed in' },
  post: { tone: 'var(--h-violet)', glyph: '●', says: 'Signed-in page view' },
  run: { tone: 'var(--h-emerald)', glyph: '▶', says: 'Opened a tool' },
} as const satisfies Record<EventKind, { tone: string; glyph: string; says: string }>;

export const KIND_TONE = (kind: EventKind): string => KIND[kind].tone;

/** A fact about somebody, small enough to sit in a row of them. */
export function Chip({
  tone = 'var(--h-indigo)',
  children,
  title,
}: {
  tone?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{ ['--tone' as string]: tone }}
      className="tinted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap"
    >
      {children}
    </span>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-center gap-1.5">{children}</div>;
}

/**
 * The legend.
 *
 * Rendered above any timeline that mixes kinds, because a coloured glyph is only
 * self-explanatory once somebody has been told what it means. Omitted on
 * timelines carrying a single kind, where it would be noise.
 */
export function JourneyLegend({ kinds }: { kinds: EventKind[] }) {
  const unique = [...new Set(kinds)];
  if (unique.length < 2) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {unique.map((k) => (
        <span key={k} className="text-subtle inline-flex items-center gap-1.5 text-[10.5px]">
          <span aria-hidden style={{ color: KIND[k].tone }} className="text-[11px] leading-none">
            {KIND[k].glyph}
          </span>
          {KIND[k].says}
        </span>
      ))}
    </div>
  );
}

export function Journey({
  events,
  /** Shown instead of an empty rail. Say why it is empty, not that it is. */
  empty,
}: {
  events: JourneyEvent[];
  empty?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-muted rounded-xl border border-dashed px-4 py-6 text-center text-[12.5px] leading-relaxed text-pretty">
        {empty
          ?? 'Nothing recorded for this person yet. Activity appears here within a minute or two of it happening.'}
      </p>
    );
  }

  return (
    <>
      <JourneyLegend kinds={events.map((e) => e.kind)} />

      <ol className="relative space-y-0">
        {/* The rail. Inset to the centre of the 22px markers, and stopped short
            at both ends so it does not overshoot the first and last dots. */}
        <span
          aria-hidden
          className="absolute top-3 bottom-3 left-[10.5px] w-px bg-[var(--border-c)]"
        />

        {events.map((event, i) => {
          const kind = KIND[event.kind];

          return (
            <li
              key={`${event.at}-${i}`}
              className="relative flex gap-3 py-2 pl-0"
              style={{ ['--tone' as string]: kind.tone }}
            >
              <span
                aria-hidden
                className="relative z-10 mt-px grid size-[22px] shrink-0 place-items-center rounded-full border bg-[var(--surface-raised)] text-[10px] leading-none"
                style={{
                  color: kind.tone,
                  borderColor: `color-mix(in oklab, ${kind.tone} 40%, var(--border-c))`,
                }}
              >
                {kind.glyph}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-[12.5px] leading-snug font-medium break-words">
                    {event.label}
                  </span>
                  <span className={cn(NUM, 'text-subtle shrink-0 text-[10.5px]')}>
                    {new Date(event.at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                      timeZone: 'Asia/Kolkata',
                    })}
                  </span>
                </span>
                {event.meta && (
                  <span className="text-subtle mt-0.5 block truncate text-[11px]" title={event.meta}>
                    {event.meta}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * The drill-down list: a KPI's set of people, before you pick one.
 *
 * Kept in this file because it is the other half of the same interaction. A card
 * whose number is a count of people opens this; clicking a row here swaps the
 * same panel over to that person's timeline, with a way back. Two levels, one
 * panel, and never a second panel stacked on the first.
 */
export function PeopleList({
  children,
  empty = 'Nobody to show here.',
}: {
  children: ReactNode;
  empty?: string;
}) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) ? rows.length === 0 : !rows;

  if (isEmpty) {
    return (
      <p className="text-muted rounded-xl border border-dashed px-4 py-6 text-center text-[12.5px]">
        {empty}
      </p>
    );
  }

  return <ul className="space-y-1.5">{rows}</ul>;
}

export function PeopleListRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="a-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition hover:bg-[var(--surface-sunken)]"
      >
        {children}
      </button>
    </li>
  );
}

/** The way back out of a drill-down, and the only affordance that returns a level. */
export function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="a-ring text-muted -ml-1 mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[11.5px] font-medium transition hover:text-[var(--text-c)]"
    >
      <span aria-hidden>&larr;</span>
      {label}
    </button>
  );
}

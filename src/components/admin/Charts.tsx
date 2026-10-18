import type { CSSProperties } from 'react';
import type { Count, Report } from '@/lib/analytics/report';
import { duration } from '@/lib/analytics/report';

/**
 * The two pictures on the Admin screen: people per day, and short ranked lists.
 * Plain elements rather than a chart library: a bar is a div with a height, the
 * numbers are in its title for hover and in an accessible table for a screen
 * reader, and it reads in both themes because every colour is a token.
 */

export function DayChart({ days }: { days: Report['days'] }) {
  const max = Math.max(1, ...days.map((d) => d.people));
  const label = (day: string) =>
    new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
  const ticks = days.length > 1 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [0];

  return (
    <figure>
      <div className="relative h-48">
        {/* Guide lines at a quarter, half and three quarters of the busiest day. */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <span
            key={f}
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-[color-mix(in_oklab,var(--border-c)_70%,transparent)]"
            style={{ bottom: `${f * 100}%` }}
          />
        ))}
        <span aria-hidden className="text-subtle absolute -top-1 right-0 -translate-y-full text-[10.5px] tabular-nums">
          {max} {max === 1 ? 'person' : 'people'}
        </span>
        <div className="relative flex h-full items-end gap-[3px]">
          {days.map((d, i) => (
            <div
              key={d.day}
              title={`${label(d.day)}: ${d.people} ${d.people === 1 ? 'person' : 'people'}, ${d.signedIn} signed in`}
              className="group relative flex h-full min-w-0 flex-1 items-end"
            >
              <div
                className="relative w-full origin-bottom animate-[rise-y_0.7s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden rounded-t-[5px] bg-[color-mix(in_oklab,var(--color-brand-500)_30%,transparent)] transition-[filter] group-hover:brightness-110"
                style={{ height: d.people ? `${Math.max(4, (d.people / max) * 100)}%` : '2px', animationDelay: `${i * 12}ms` } as CSSProperties}
              >
                <span
                  className="absolute inset-x-0 bottom-0 bg-[var(--color-brand-500)]"
                  style={{ height: d.people ? `${(d.signedIn / d.people) * 100}%` : 0 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-subtle relative mt-2 h-4 text-[10.5px]">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
            style={{ left: `${days.length > 1 ? (t / (days.length - 1)) * 100 : 0}%` }}
          >
            {label(days[t].day)}
          </span>
        ))}
      </div>
      <figcaption className="text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-[var(--color-brand-500)]" /> Signed in
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-[color-mix(in_oklab,var(--color-brand-500)_30%,transparent)]" /> Not signed in
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>People per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th>{d.day}</th>
              <td>{d.people} people</td>
              <td>{d.signedIn} signed in</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A short ranked list with a bar behind each row. */
export function BarList({ items, unit, showTime = false, empty }: { items: Count[]; unit: string; showTime?: boolean; empty: string }) {
  if (items.length === 0) return <p className="text-subtle py-6 text-center text-[13px]">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ol className="space-y-1.5">
      {items.map((item, i) => (
        <li key={item.label} className="relative overflow-hidden rounded-lg px-3 py-2">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 origin-left animate-[grow_0.8s_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-lg bg-[color-mix(in_oklab,var(--color-brand-500)_13%,transparent)]"
            style={{ width: `${(item.value / max) * 100}%`, animationDelay: `${i * 60}ms` }}
          />
          <span className="relative flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium" title={item.label}>
              {item.label}
            </span>
            <span className="text-muted shrink-0 tabular-nums">
              {item.value} {item.value === 1 ? unit : `${unit}s`}
              {showTime && item.seconds ? <span className="text-subtle"> · {duration(item.seconds)}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

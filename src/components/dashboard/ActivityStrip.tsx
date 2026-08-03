import { fmtRupees } from '@/lib/domain/voucher';

/**
 * Thirty days of this person's own work, one column per day.
 *
 * The dashboard could say "12 vouchers this month" in words. A strip says the same
 * thing and also answers the question underneath it — whether the work arrives
 * steadily or in a rush before a filing date — which is the part that changes how
 * somebody plans their week.
 *
 * Weekends are drawn on a fainter track, so a spike on a Sunday is legible as a
 * spike on a Sunday. Everything is bucketed in UTC from an Asia/Kolkata `today`,
 * so a voucher raised at nine in the evening lands on the day it was raised.
 */
export function ActivityStrip({
  rows,
  today,
  days = 30,
}: {
  rows: { created_at: string; grand_total: string | number }[];
  /** Today in Asia/Kolkata, `yyyy-mm-dd`. */
  today: string;
  days?: number;
}) {
  const [y, m, d] = today.split('-').map(Number);
  const end = Date.UTC(y, m - 1, d);

  const buckets = Array.from({ length: days }, (_, i) => {
    const at = end - (days - 1 - i) * 86_400_000;
    const date = new Date(at);
    return {
      at,
      label: date.toLocaleDateString('en-IN', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
      }),
      weekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
      count: 0,
      value: 0,
    };
  });

  const index = new Map(buckets.map((b, i) => [b.at, i]));

  for (const row of rows) {
    // created_at is a timestamptz; its ISO form is UTC, and the IST date is the
    // UTC instant plus 5h30m. Truncating that to a day is the bucket.
    const ist = new Date(new Date(row.created_at).getTime() + 5.5 * 3_600_000);
    const key = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
    const i = index.get(key);
    if (i === undefined) continue;
    buckets[i].count += 1;
    buckets[i].value += Number(row.grand_total ?? 0);
  }

  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const value = buckets.reduce((s, b) => s + b.value, 0);
  const busiest = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm">
          <span className="numeric font-semibold">{total}</span>
          <span className="text-muted"> raised in the last {days} days</span>
        </p>
        <p className="text-subtle numeric text-xs">{fmtRupees(value)}</p>
      </div>

      {/* One column per day. `items-end` is what makes them grow from the floor. */}
      <div className="mt-4 flex h-16 items-end gap-[2px]" role="img" aria-label={ariaLabel(total, days, busiest)}>
        {buckets.map((b, i) => (
          <span
            key={b.at}
            title={`${b.label}: ${b.count === 0 ? 'nothing raised' : `${b.count} voucher${b.count === 1 ? '' : 's'} · ${fmtRupees(b.value)}`}`}
            className="group relative flex h-full flex-1 items-end"
          >
            {/* The track. Present even on an empty day, so the strip reads as
                thirty days rather than as however many had work in them. */}
            <span
              aria-hidden
              className={
                b.weekend
                  ? 'absolute inset-x-0 bottom-0 h-full rounded-[2px] bg-[var(--surface-sunken)] opacity-50'
                  : 'absolute inset-x-0 bottom-0 h-full rounded-[2px] bg-[var(--surface-sunken)]'
              }
            />
            {b.count > 0 && (
              <span
                aria-hidden
                className="a-fill-y gradient-brand relative w-full rounded-[2px] transition-[filter] group-hover:brightness-125"
                style={{
                  height: `${Math.max(12, (b.count / peak) * 100)}%`,
                  animationDelay: `${i * 14}ms`,
                }}
              />
            )}
          </span>
        ))}
      </div>

      <div className="text-subtle mt-2 flex items-center justify-between text-[10px]">
        <span className="numeric">{buckets[0].label}</span>
        <span className="numeric">Today</span>
      </div>
    </div>
  );
}

function ariaLabel(total: number, days: number, busiest: { label: string; count: number }) {
  if (total === 0) return `Nothing raised in the last ${days} days.`;
  return `${total} vouchers raised in the last ${days} days. Busiest day ${busiest.label}, with ${busiest.count}.`;
}

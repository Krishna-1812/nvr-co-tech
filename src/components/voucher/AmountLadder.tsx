import { fmtRupees } from '@/lib/domain/voucher';
import { cn } from '@/lib/utils';

/**
 * How the grand total was arrived at, with every component plotted as well as
 * printed.
 *
 * The old version of this was a clean list of labels and figures. The problem with
 * a clean list is that ₹9,000 of CGST and ₹90,000 of basic value are the same size
 * on the page, so checking that a total looks plausible means reading eleven
 * numbers and doing arithmetic. With a bar behind each line, a TDS deduction that
 * should have been a rounding error and is instead a third of the invoice is
 * visible before you have read a digit.
 *
 * Bars are scaled to the largest single component, not to the total, because the
 * question they answer is "how do these compare to each other".
 *
 * Additions and deductions get different colours and the sign keeps its own
 * fixed-width column, so the two groups read as two groups. On a printed voucher
 * that is the difference between checking the arithmetic and taking it on trust.
 */

export type Line = { label: string; value: number; sign?: '+' | '−' };

export function AmountLadder({
  additions,
  deductions,
  netTotal,
  grandTotal,
}: {
  additions: Line[];
  deductions: Line[];
  netTotal: number;
  grandTotal: number;
}) {
  const peak = Math.max(
    1,
    ...additions.map((l) => Math.abs(l.value)),
    ...deductions.map((l) => Math.abs(l.value)),
  );

  return (
    <div>
      <div className="space-y-px px-5 py-3">
        {additions.map((line, i) => (
          <Rung key={line.label} line={line} peak={peak} delay={i * 60} />
        ))}
      </div>

      <Subtotal label="Net total" value={netTotal} />

      {deductions.length > 0 && (
        <div className="space-y-px px-5 py-3">
          {deductions.map((line, i) => (
            <Rung
              key={line.label}
              line={line}
              peak={peak}
              delay={(additions.length + i) * 60}
              negative={line.sign === '−'}
            />
          ))}
        </div>
      )}

      {/*
        The grand total leaves the ladder and sits on the brand, because it is the
        figure being authorised — every other row on this card only explains how it
        was reached. The travelling highlight is the app's one per-screen flourish,
        and this is the surface it is spent on.
      */}
      <div className="gradient-brand relative overflow-hidden">
        <span aria-hidden className="a-shine absolute inset-0" />
        <div className="relative flex items-baseline justify-between gap-4 px-5 py-4">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-85">
            Grand total
          </span>
          <span className="a-figure text-xl sm:text-2xl">{fmtRupees(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

/** One component of the total: sign, label, figure, and the bar under all three. */
function Rung({
  line,
  peak,
  delay,
  negative = false,
}: {
  line: Line;
  peak: number;
  delay: number;
  negative?: boolean;
}) {
  const width = Math.max(2, (Math.abs(line.value) / peak) * 100);
  const tone = negative ? 'var(--status-warn)' : 'var(--color-brand-500)';

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span
            aria-hidden
            className="text-subtle numeric w-2 shrink-0 text-center text-xs font-semibold"
          >
            {line.sign}
          </span>
          <span className="text-muted truncate text-sm">{line.label}</span>
        </span>
        <span className="numeric shrink-0 text-sm">{fmtRupees(line.value)}</span>
      </div>
      <div className="a-track mt-1.5 ml-3.5 h-[3px] overflow-hidden rounded-full">
        <span
          className="a-fill block h-full rounded-full"
          style={{ width: `${width}%`, background: tone, animationDelay: `${delay}ms`, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

/** A running total. Heavier rules above and below, so it reads as a line drawn. */
function Subtotal({ label, value, strong = true }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-y bg-[var(--surface-sunken)] px-5 py-2.5">
      <span className={cn('text-sm', strong ? 'font-semibold' : 'text-muted')}>{label}</span>
      <span className="amount text-base font-bold">{fmtRupees(value)}</span>
    </div>
  );
}

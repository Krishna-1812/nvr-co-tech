import { Select, buttonClass } from '@/components/ui/primitives';
import type { Statistic } from '@/lib/comps/types';

/**
 * Choosing the subject and the statistic.
 *
 * ── Why this is not in PageHeader's action slot ───────────────────────────
 *
 * It was, and at a phone width the whole page scrolled sideways by 170px. That
 * slot is wrapped in `flex shrink-0`, and its own comment says what it is for:
 * the *primary control* for the page, right-aligned on wider viewports. One
 * button. `shrink-0` is correct for that and fatal for this — three controls
 * totalling 460px in a container that refuses to shrink is a container that
 * overflows, and no amount of `flex-wrap` inside it helps, because the parent has
 * already sized itself to its content.
 *
 * So it lives here instead, in the card above the table, which is where
 * `VoucherFilters` and the ledger difference table both put theirs. The bar is
 * inside the container it filters, which is also the clearer place for it.
 *
 * ── It is a plain GET form ────────────────────────────────────────────────
 *
 * No client component and no `useState`, so the whole screen is a URL. A
 * comparables schedule is something people send each other, and a screen whose
 * state lives in a hook cannot be linked to — the same reason the analytics
 * window and segment are URL params.
 */

const STATISTICS: { value: Statistic; label: string }[] = [
  { value: 'median', label: 'Median' },
  { value: 'mean', label: 'Mean' },
  { value: 'q1', label: 'Lower quartile' },
  { value: 'q3', label: 'Upper quartile' },
];

export function SubjectBar({
  choices,
  subjectId,
  statistic,
}: {
  choices: { id: string; name: string }[];
  subjectId: string;
  statistic: Statistic;
}) {
  return (
    <form
      method="get"
      /*
       * `min-w-0` on the selects and no minimum width on the bar, so at a phone
       * width the three controls wrap onto as many lines as they need. The
       * company names are long — a select at its content width is 236px — so
       * without this they do not fit two to a line at 375 and the row would push
       * the page wider than the screen.
       */
      className="flex flex-wrap items-center gap-2 border-b px-4 py-3"
    >
      <label className="min-w-0 flex-1 sm:flex-none">
        <span className="sr-only">Company to value</span>
        <Select name="subject" defaultValue={subjectId} className="w-full sm:w-56">
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-0 flex-1 sm:flex-none">
        <span className="sr-only">Statistic to apply</span>
        <Select name="stat" defaultValue={statistic} className="w-full sm:w-40">
          {STATISTICS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </label>

      {/*
       * h-11 below lg, not h-10. The touch band in this app is 640–1023, because
       * MobileDock is `lg:hidden` — so a tablet is a thumb and gets the bigger
       * target, and the 40px desktop height only starts where the dock stops.
       */}
      <button type="submit" className={buttonClass({ variant: 'primary', className: 'h-11 lg:h-10' })}>
        Show
      </button>
    </form>
  );
}

export { STATISTICS };

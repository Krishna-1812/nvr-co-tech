'use client';

import type { CSSProperties } from 'react';
import { CheckCircle2, Home, Info, TriangleAlert } from 'lucide-react';
import { Field } from '@/components/ui/primitives';
import { formatINR } from '@/lib/recon/amount';
import { rentalYield, type LandedCost, type Rental, type Schedule } from '@/lib/landed/calc';
import { METHOD, rentVerdict } from '@/lib/landed/words';
import { NumberInput } from './Controls';
import { Panel } from './Panels';
import { TONE, pct } from './shared';

/**
 * Rental yield, measured against what the property really cost.
 *
 * The inputs are the ones an owner actually knows — the rent, the society's
 * maintenance, the property tax, how long it usually sits empty — and the
 * answer leads with the one comparison that decides whether the flat pays: the
 * net yield beside what the money in it costs a year. The broker's figure, the
 * gross yield on the agreement price, is shown too, labelled for what it is.
 */
export function RentalPanel({
  schedule,
  result,
  onChange,
}: {
  schedule: Schedule;
  result: LandedCost;
  onChange: (rental: Rental) => void;
}) {
  const rental = schedule.rental ?? {};
  const set = (patch: Partial<Rental>) => onChange({ ...rental, ...patch });
  const y = rentalYield(schedule, result);

  return (
    <Panel
      icon={<Home className="size-4" />}
      title="Rental yield"
      description="What the property earns once it is let, against what it really cost and what that money costs a year."
    >
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
        {/* ── What it lets for ── */}
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field label="Expected rent a month" htmlFor="lc-rent" required className="sm:col-span-2">
            <NumberInput
              id="lc-rent"
              value={rental.monthlyRent}
              onCommit={(v) => set({ monthlyRent: v })}
              prefix="₹"
              placeholder="32,000"
              inputClassName="text-[1.05rem] font-semibold"
            />
          </Field>
          <Field label="Maintenance a month" htmlFor="lc-maint" hint="Society charges you pay">
            <NumberInput id="lc-maint" value={rental.maintenanceMonthly} onCommit={(v) => set({ maintenanceMonthly: v })} prefix="₹" placeholder="0" />
          </Field>
          <Field label="Other costs a year" htmlFor="lc-costs" hint="Property tax, insurance, repairs">
            <NumberInput id="lc-costs" value={rental.annualCosts} onCommit={(v) => set({ annualCosts: v })} prefix="₹" placeholder="0" />
          </Field>
          <Field label="Vacancy" htmlFor="lc-vacancy" hint="Share of the year empty. One month is 8.33%">
            <NumberInput id="lc-vacancy" value={rental.vacancyPct} onCommit={(v) => set({ vacancyPct: v })} suffix="%" placeholder="0" />
          </Field>
          <Field label="Market value today" htmlFor="lc-market" hint="Optional, for a yield on value">
            <NumberInput id="lc-market" value={rental.marketValue} onCommit={(v) => set({ marketValue: v })} prefix="₹" placeholder="Optional" />
          </Field>
        </div>

        {/* ── What that is worth ── */}
        {y ? <YieldResult y={y} /> : <YieldEmpty />}
      </div>
    </Panel>
  );
}

function YieldEmpty() {
  return (
    <div className="surface-sunken grid place-items-center rounded-3xl border border-dashed p-8 text-center">
      <div>
        <Home className="text-subtle mx-auto size-6" aria-hidden />
        <p className="mt-3 font-semibold">Enter the expected rent</p>
        <p className="text-muted mx-auto mt-1 max-w-xs text-[13px] text-pretty">
          The yield is worked out on the true cost, and set beside what the money in the property costs you a year.
        </p>
      </div>
    </div>
  );
}

function YieldResult({ y }: { y: NonNullable<ReturnType<typeof rentalYield>> }) {
  const verdict = rentVerdict(y);
  const covers = verdict.covers;
  // One scale for both bars, so their lengths can be compared directly.
  const scale = Math.max(y.netOnTrue, y.blendedRate, 0.01) * 1.15;
  const bar = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
  const verdictTone = covers ? 'var(--status-approved)' : 'var(--status-warn)';
  const Verdict = covers ? CheckCircle2 : TriangleAlert;

  return (
    <div className="min-w-0">
      <div className="surface-sunken a-inner rounded-3xl border p-5">
        <p className="a-label">Net yield on true cost</p>
        <p className="mt-2 text-[clamp(2.2rem,5vw,3rem)] leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {pct(Math.round(y.netOnTrue * 100) / 100)}
        </p>
        <p className="text-muted mt-2 text-[13px]">
          {formatINR(y.netAnnual)} a year after vacancy and costs
        </p>

        {/* The comparison that decides it: the yield against the cost of the money. */}
        <div className="mt-5 space-y-3">
          <Bar label="Net yield" value={y.netOnTrue} width={bar(y.netOnTrue)} tone={TONE.self} />
          <Bar label="Cost of the money" value={y.blendedRate} width={bar(y.blendedRate)} tone={TONE.carry} />
        </div>

        <p
          style={{ '--tone': verdictTone } as CSSProperties}
          className="tinted mt-5 flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-[13px] font-medium text-pretty"
        >
          <Verdict className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{verdict.text}</span>
        </p>
      </div>

      {/* Two tiles, or three with a market value: the columns follow, so two never leave a gap. */}
      <dl className={`mt-3 grid grid-cols-2 gap-3 ${y.netOnMarket !== undefined ? 'sm:grid-cols-3' : ''}`}>
        <Stat label="Gross on price" value={pct(Math.round(y.grossOnPaid * 100) / 100)} note="The yield usually quoted" />
        <Stat label="Gross on true cost" value={pct(Math.round(y.grossOnTrue * 100) / 100)} note="Before vacancy and costs" />
        {y.netOnMarket !== undefined && (
          <Stat label="Net on market value" value={pct(Math.round(y.netOnMarket * 100) / 100)} note="On the value entered" />
        )}
      </dl>

      <p className="text-subtle mt-3 flex items-start gap-1.5 text-[12px] text-pretty">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        {METHOD.yieldBasis}
      </p>
    </div>
  );
}

function Bar({ label, value, width, tone }: { label: string; value: number; width: string; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-muted inline-flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: tone }} />
          {label}
        </span>
        <span className="font-semibold tabular-nums">{pct(Math.round(value * 100) / 100)}</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--a-track)]">
        <span
          className="block h-full origin-left animate-[grow_0.8s_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-full"
          style={{ width, background: tone }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="surface-sunken min-w-0 rounded-2xl border p-3.5">
      <dt className="a-label truncate">{label}</dt>
      <dd className="mt-1.5 truncate text-[1.05rem] font-semibold tabular-nums">{value}</dd>
      <dd className="text-subtle mt-0.5 text-[11.5px] leading-snug">{note}</dd>
    </div>
  );
}

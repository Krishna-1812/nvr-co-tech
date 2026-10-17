'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Building, CalendarClock, Percent, TrendingUp } from 'lucide-react';
import { Field, Input } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/recon/amount';
import {
  COMPOUNDING_LABEL,
  delayCase,
  type Compounding,
  type FundSource,
  type Schedule,
} from '@/lib/landed/calc';
import { NumberInput, Segmented, Slider } from './Controls';
import { SOURCE_ICON, SOURCE_TONE, TONE, compactINR, longDate, pct } from './shared';

/** The frame every panel on this screen sits in. */
export function Panel({
  icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface-lit a-ring relative overflow-hidden rounded-3xl', className)}>
      <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="surface-sunken text-muted grid size-9 shrink-0 place-items-center rounded-xl border">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold tracking-tight">{title}</h2>
            {description && <p className="text-muted mt-0.5 text-[13px] text-pretty">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}

export function PropertyPanel({
  schedule,
  onChange,
  footer,
}: {
  schedule: Schedule & { name: string };
  onChange: (patch: Partial<Schedule & { name: string }>) => void;
  footer: ReactNode;
}) {
  return (
    <Panel icon={<Building className="size-4" />} title="The property" description="Interest on every payment runs up to the OC date.">
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Name" htmlFor="lc-name" className="sm:col-span-2">
          <Input
            id="lc-name"
            value={schedule.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Tower B, Flat 1204"
            autoComplete="off"
          />
        </Field>
        <Field
          label="OC / possession date"
          htmlFor="lc-oc"
          required
          hint={schedule.ocDate ? longDate(schedule.ocDate) : 'The expected date, if it has not been issued'}
        >
          <Input id="lc-oc" type="date" value={schedule.ocDate} onChange={(e) => onChange({ ocDate: e.target.value })} />
        </Field>
        <Field label="Carpet area" htmlFor="lc-area" hint="Optional, for a cost per sq ft">
          <NumberInput id="lc-area" value={schedule.areaSqft} onCommit={(v) => onChange({ areaSqft: v })} placeholder="1,050" suffix="sq ft" inputClassName="pr-14" />
        </Field>
      </div>
      <div className="flex justify-end border-t px-5 py-3 sm:px-6">{footer}</div>
    </Panel>
  );
}

const COMPOUNDING_SHORT: Record<Compounding, string> = {
  simple: 'Simple',
  annual: 'Yearly',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
};

export function FundsPanel({
  schedule,
  onChange,
}: {
  schedule: Schedule;
  onChange: (patch: Partial<Schedule>) => void;
}) {
  const rate = (source: FundSource, v: number | undefined) =>
    onChange({ rates: { ...schedule.rates, [source]: v ?? Number.NaN } });

  return (
    <Panel icon={<Percent className="size-4" />} title="Cost of funds" description="One rate per source, applied to every payment made from it.">
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        {(['self', 'borrowed'] as const).map((s) => {
          const Icon = SOURCE_ICON[s];
          const value = schedule.rates[s];
          return (
            <div key={s} className="surface-sunken rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold">
                  <span aria-hidden className="grid size-6 place-items-center rounded-lg text-[var(--surface-raised)]" style={{ background: SOURCE_TONE[s] }}>
                    <Icon className="size-3.5" />
                  </span>
                  {s === 'self' ? 'Own funds' : 'Borrowed funds'}
                </p>
                <NumberInput
                  aria-label={s === 'self' ? 'Cost of own funds, percent a year' : 'Cost of borrowed funds, percent a year'}
                  value={Number.isFinite(value) ? value : undefined}
                  onCommit={(v) => rate(s, v)}
                  suffix="%"
                  // Never squeezed by a label that wraps: at 1440px the two
                  // source cards sit side by side and "8.5" was clipping to "8.".
                  className="w-24 shrink-0"
                  inputClassName="h-9 py-1 font-semibold"
                />
              </div>
              <div className="mt-3">
                <Slider
                  label={s === 'self' ? 'Cost of own funds' : 'Cost of borrowed funds'}
                  value={Number.isFinite(value) ? value : 0}
                  min={0}
                  max={20}
                  step={0.05}
                  tone={SOURCE_TONE[s]}
                  valueText={`${pct(Number.isFinite(value) ? value : 0)} a year`}
                  onChange={(v) => rate(s, Math.round(v * 100) / 100)}
                />
              </div>
              <p className="text-subtle mt-1 text-[12px]">
                {s === 'self' ? 'What the money would have earned' : "The loan's interest rate"}
              </p>
            </div>
          );
        })}

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">Interest method</p>
          <Segmented
            label="Interest method"
            value={schedule.compounding}
            onChange={(c) => onChange({ compounding: c })}
            options={(Object.keys(COMPOUNDING_SHORT) as Compounding[]).map((c) => ({ value: c, label: COMPOUNDING_SHORT[c] }))}
          />
          <p className="text-subtle mt-2 text-[12px]">
            {COMPOUNDING_LABEL[schedule.compounding]}, days counted actual/365.
            {schedule.compounding === 'simple' && ' This is how a lender charges pre-EMI interest during construction.'}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/**
 * What if possession slips.
 *
 * Builder delays are the ordinary case rather than the exception, and the cost
 * of one is exactly what this tool knows how to work out: the same schedule,
 * carried to a later OC date. The slider moves the OC; the figures are the
 * difference it makes and what each month of it costs on average.
 */
export function DelayPanel({ schedule }: { schedule: Schedule }) {
  const [months, setMonths] = useState(6);
  const late = useMemo(() => delayCase(schedule, months), [schedule, months]);
  const { extra, perMonth } = late;

  return (
    <Panel
      icon={<CalendarClock className="size-4" />}
      title="If possession slips"
      description="The same payments, carried to a later OC date."
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="a-label">OC moves by</p>
            <p className="mt-1 text-[1.6rem] leading-none font-semibold tracking-tight tabular-nums">
              {months} {months === 1 ? 'month' : 'months'}
            </p>
          </div>
          <p className="text-muted text-right text-[13px]">
            to <span className="font-semibold text-[var(--text-c)]">{longDate(late.ocDate)}</span>
          </p>
        </div>
        <div className="mt-4">
          <Slider
            label="Months of delay to possession"
            value={months}
            min={0}
            max={36}
            step={1}
            tone={TONE.carry}
            valueText={`${months} months`}
            onChange={setMonths}
          />
          <div className="text-subtle mt-1 flex justify-between text-[11px] tabular-nums">
            <span>On time</span>
            <span>1 yr</span>
            <span>2 yr</span>
            <span>3 yr</span>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="surface-sunken rounded-2xl border p-3.5">
            <dt className="a-label">Extra carrying cost</dt>
            <dd className="mt-1.5 text-lg font-semibold tabular-nums">
              {months === 0 ? '—' : `+${compactINR(extra)}`}
            </dd>
            <dd className="text-subtle text-[12px]">{months === 0 ? 'Move the slider' : `≈ ${compactINR(perMonth)} a month`}</dd>
          </div>
          <div className="surface-sunken rounded-2xl border p-3.5">
            <dt className="a-label">True cost then</dt>
            <dd className="mt-1.5 text-lg font-semibold tabular-nums">{compactINR(late.landed)}</dd>
            <dd className="text-subtle text-[12px]">{pct(Math.round(late.upliftPct * 100) / 100)} over paid</dd>
          </div>
        </dl>
        {months > 0 && (
          <p className="text-muted mt-4 flex items-start gap-2 text-[13px] text-pretty">
            <TrendingUp className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              A {months}-month delay adds <span className="font-semibold text-[var(--text-c)]">{formatINR(extra)}</span>, money that
              is already spent and still waiting.
            </span>
          </p>
        )}
      </div>
    </Panel>
  );
}

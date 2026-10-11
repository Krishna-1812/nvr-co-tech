'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { addMonths, landedCost, rentalYield, timeline, withDelay, type Schedule } from '@/lib/landed/calc';
import { EXAMPLE_NAME, exampleSchedule } from '@/lib/landed/example';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import { MoneyChart } from '@/components/landed/MoneyChart';
import { Odometer } from '../play/Odometer';

/**
 * True Property Cost, working, on its own public page.
 *
 * The property is the tool's own worked example (lib/landed/example — the same
 * one "Load example" opens inside the product), and every figure on this panel
 * is the real calculator's answer for it: `landedCost`, `withDelay`,
 * `rentalYield` and `timeline` from lib/landed/calc, the same functions the
 * signed-in tool calls. The visitor moves three things the tool lets them move
 * — how late possession is, what their own money would otherwise earn, and the
 * loan rate — and watches the true cost turn over digit by digit, and the chart
 * of the money redraw under it.
 *
 * Runs in the browser and stores nothing.
 */

const MONTHS_MAX = 36;

export function PropertyDemo() {
  const base = useMemo(() => exampleSchedule(), []);
  const [delay, setDelay] = useState(0);
  const [self, setSelf] = useState(base.rates.self);
  const [borrowed, setBorrowed] = useState(base.rates.borrowed);

  const schedule: Schedule = useMemo(
    () => withDelay({ ...base, rates: { self, borrowed } }, delay),
    [base, self, borrowed, delay],
  );
  const result = useMemo(() => landedCost(schedule), [schedule]);
  const points = useMemo(() => timeline(schedule), [schedule]);
  const rent = useMemo(() => rentalYield(schedule, result), [schedule, result]);
  const onTime = useMemo(() => landedCost({ ...base, rates: { self, borrowed } }), [base, self, borrowed]);
  const slipCost = result.landed - onTime.landed;

  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="m-card relative overflow-hidden rounded-[2rem]">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* ── The three things to move ── */}
        <div className="border-b border-[var(--m-line)] p-6 sm:p-8 lg:border-r lg:border-b-0 lg:p-10">
          <p className="m-eyebrow">{EXAMPLE_NAME}</p>
          <p className="m-dim mt-3 t-3">
            Eight payments over three years, part from savings and part on a loan, for a{' '}
            {base.areaSqft} sq ft flat due on {formatLedgerDate(base.ocDate)}. Move any of these and the
            calculator works the whole thing out again.
          </p>

          <div className="mt-8 space-y-8">
            <Slider
              label="Possession slips by"
              value={delay}
              min={0}
              max={MONTHS_MAX}
              step={1}
              onChange={setDelay}
              display={
                delay === 0
                  ? 'On time'
                  : `${delay} ${delay === 1 ? 'month' : 'months'} · ${formatLedgerDate(addMonths(base.ocDate, delay))}`
              }
              note={delay === 0 ? 'Drag to see what a late handover costs.' : `${formatINR(Math.round(slipCost)).replace(/\.00$/, '')} more, only for waiting.`}
            />
            <Slider
              label="Your own money would earn"
              value={self}
              min={3}
              max={12}
              step={0.25}
              onChange={setSelf}
              display={`${self.toFixed(2)}% a year`}
              note="What the savings put in could have made elsewhere."
            />
            <Slider
              label="Home loan rate"
              value={borrowed}
              min={6}
              max={12}
              step={0.25}
              onChange={setBorrowed}
              display={`${borrowed.toFixed(2)}% a year`}
              note="Interest on the instalments paid from the loan."
            />
          </div>
        </div>

        {/* ── The answer ── */}
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="m-eyebrow">True cost by possession</p>
          <p className="m-display mt-3 text-[clamp(2.4rem,6vw,4rem)] leading-none tabular-nums" aria-live="polite">
            <Odometer value={formatINR(Math.round(result.landed), { symbol: true }).replace(/\.00$/, '')} roll="view" />
          </p>
          <p className="m-dim mt-4 t-3">
            {formatINR(Math.round(result.paid)).replace(/\.00$/, '')} paid, plus{' '}
            <span className="font-semibold text-[var(--m-gold)]">
              {formatINR(Math.round(result.interest)).replace(/\.00$/, '')}
            </span>{' '}
            that the money cost while it was tied up: {pct(result.upliftPct)} on top of the price.
            {result.perSqft && (
              <>
                {' '}
                {formatINR(Math.round(result.perSqft.landed)).replace(/\.00$/, '')} a square foot, not{' '}
                {formatINR(Math.round(result.perSqft.paid)).replace(/\.00$/, '')}.
              </>
            )}
          </p>

          <div className="mt-6">
            <MoneyChart points={points} rows={result.rows} ocDate={schedule.ocDate} />
          </div>

          {rent && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Fact label="Yield a broker quotes" value={pct(rent.grossOnPaid)} note="Gross rent on the price" />
              <Fact label="Yield on the true cost" value={pct(rent.netOnTrue)} note="Net of costs and vacancy" strong />
              <Fact
                label={rent.spread >= 0 ? 'Rent beats the money by' : 'Rent falls short by'}
                value={pct(Math.abs(rent.spread))}
                note={`Against ${pct(rent.blendedRate)} the money costs`}
              />
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              data-signup=""
              className="m-flood group inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--m-ink)] px-7 t-3 font-semibold text-[var(--m-on-grad)] active:scale-[0.985]"
            >
              Work out your own property
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <span className="m-dim-2 t-2">Pre-tax, simple interest, no appreciation. Stamp duty and GST are in the payments.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  note,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  display: string;
  note: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="t-3 font-semibold text-[var(--m-ink)]">{label}</span>
        <span className="m-mono t-2 tabular-nums text-[var(--m-gold)]">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="m-range mt-3 w-full"
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
      />
      <span className="m-dim-2 mt-2 block t-2">{note}</span>
    </label>
  );
}

function Fact({ label, value, note, strong = false }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? 'rounded-2xl bg-[var(--m-ink)] px-4 py-3.5 text-[var(--m-on-grad)]'
          : 'rounded-2xl border border-[var(--m-line)] bg-[var(--m-bg)] px-4 py-3.5'
      }
    >
      <p className={strong ? 'm-mono t-1 t-caps uppercase opacity-80' : 'm-eyebrow'}>{label}</p>
      <p className="m-display mt-1.5 t-6 tabular-nums">
        <Odometer value={value} roll="none" />
      </p>
      <p className={strong ? 't-2 opacity-80' : 'm-dim-2 t-2'}>{note}</p>
    </div>
  );
}

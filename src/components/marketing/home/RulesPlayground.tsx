'use client';

import { useState } from 'react';
import { Info, MapPin, Percent } from 'lucide-react';
import { calcGrandTotal, calcNetTotal, fmtRupees } from '@/lib/domain/voucher';
import { GST_RATES, TDS_SECTIONS } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../bits';
import { Reveal } from '../Reveal';
import { Roost } from '../Owl';

/**
 * The tax rules, as something you can drive rather than read about.
 *
 * The arithmetic is not reimplemented here. `calcNetTotal` and `calcGrandTotal`
 * are imported from the application's own domain module — the same two functions
 * the voucher form calls, and the same two the database mirrors as generated
 * columns. A visitor moving this slider is watching the real rules run, which is
 * the only reason it is worth putting on a marketing page at all.
 *
 * The one thing it demonstrates that prose cannot: choosing inter-state empties
 * CGST and SGST and fills IGST instead. Never both. That is the mistake this
 * replaces, and here you can see it being impossible.
 */

/*
 * Bounded to the range an association payment voucher actually falls in. An
 * upper bound of a few crore would be more impressive and would also park the
 * default at seven per cent of the track, which reads as a slider nobody has
 * touched. The step is 2,000 so the opening value is on it and the first drag
 * does not jump.
 */
const MIN = 10_000;
const MAX = 600_000;
const STEP = 2_000;

export function RulesPlayground() {
  const [basic, setBasic] = useState(184_000);
  const [rate, setRate] = useState<number>(18);
  const [interState, setInterState] = useState(true);
  const [section, setSection] = useState<string>('194C');

  const tax = Math.round(basic * (rate / 100) * 100) / 100;
  const cgst = interState ? 0 : tax / 2;
  const sgst = interState ? 0 : tax / 2;
  const igst = interState ? tax : 0;

  const tdsRate = TDS_SECTIONS.find((s) => s.code === section)?.rate ?? 0;
  // TDS is deducted on the basic value, not on the tax-inclusive total.
  const tds = Math.round(basic * (tdsRate / 100) * 100) / 100;

  const fields = { basic_value: basic, cgst, sgst, igst, tds };
  const net = calcNetTotal(fields);
  const grand = calcGrandTotal(fields);

  return (
    <section className="relative border-t border-[var(--m-line)] py-20 sm:py-28">
      <span
        aria-hidden
        className="m-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_50%,#000,transparent)]"
      />

      <Roost seed="rules-gable" band="top-right" />

      <Container className="relative">
        <Reveal>
          <Eyebrow className="mb-4">Have a go</Eyebrow>
          <h2 className="m-display s-settle max-w-3xl text-[clamp(1.9rem,4.2vw,3.25rem)]">
            Move the numbers. <span className="m-serif m-grad-text">See what happens.</span>
          </h2>
          <p className="m-dim mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-base">
            The sums below run the same two functions the voucher form itself calls.
            Saving does not trust them either: the totals are recomputed by the database as generated
            columns, and a voucher claiming GST two ways at once is refused by a constraint on the
            table. This is not a pretend calculator. It is the working, with the same two rules
            standing behind it.
          </p>
        </Reveal>

        <Reveal delay={90}>
          <div className="m-card m-ring mt-12 grid overflow-hidden rounded-3xl lg:grid-cols-[1fr_0.85fr]">
            {/* ── Controls ── */}
            <div className="space-y-7 p-6 sm:p-8">
              <Control
                label="Basic value (A)"
                hint="Drag, or use the arrow keys."
                value={fmtRupees(basic)}
              >
                <input
                  type="range"
                  min={MIN}
                  max={MAX}
                  step={STEP}
                  value={basic}
                  onChange={(e) => setBasic(Number(e.target.value))}
                  aria-label="Basic value in rupees"
                  className="m-range w-full"
                  // How much of the track is filled. Read by .m-range in CSS;
                  // there is no way to get at a range input's own progress from
                  // a stylesheet.
                  style={
                    { '--fill': `${((basic - MIN) / (MAX - MIN)) * 100}%` } as React.CSSProperties
                  }
                />
              </Control>

              <Control label="Place of supply" icon={MapPin}>
                <Segmented
                  options={[
                    { value: 'intra', label: 'Intra-state' },
                    { value: 'inter', label: 'Inter-state' },
                  ]}
                  value={interState ? 'inter' : 'intra'}
                  onChange={(v) => setInterState(v === 'inter')}
                />
              </Control>

              <Control label="GST rate" icon={Percent}>
                <div className="flex flex-wrap gap-2">
                  {GST_RATES.map((r) => (
                    <Chip key={r} active={rate === r} onClick={() => setRate(r)}>
                      {r}%
                    </Chip>
                  ))}
                </div>
              </Control>

              <Control
                label="TDS section"
                hint={TDS_SECTIONS.find((s) => s.code === section)?.note}
              >
                <div className="flex flex-wrap gap-2">
                  {TDS_SECTIONS.map((s) => (
                    <Chip key={s.code} active={section === s.code} onClick={() => setSection(s.code)}>
                      {s.code}
                      {s.rate > 0 && <span className="m-dim-2 ml-1.5">{s.rate}%</span>}
                    </Chip>
                  ))}
                </div>
              </Control>
            </div>

            {/* ── The ladder ── */}
            <div className="border-t border-[var(--m-line)] bg-white/[0.022] p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <p className="m-eyebrow">Amount breakdown</p>

              <dl className="mt-6 space-y-3">
                <Row label="Basic value (A)" value={fmtRupees(basic)} />
                {/*
                  All three GST rows stay mounted and the inapplicable pair is
                  struck through rather than hidden. Watching CGST and SGST go
                  dead the moment you choose inter-state is the demonstration;
                  removing them would just be a shorter list.
                */}
                <Row label="CGST" value={fmtRupees(cgst)} dead={interState} />
                <Row label="SGST" value={fmtRupees(sgst)} dead={interState} />
                <Row label="IGST" value={fmtRupees(igst)} dead={!interState} />
                <Row label="Net total (A + B + C)" value={fmtRupees(net)} strong />
                <Row
                  label={`(−) TDS ${section === 'None' ? '' : section}`.trim()}
                  value={tds > 0 ? `− ${fmtRupees(tds)}` : fmtRupees(0)}
                  dead={tds === 0}
                />
              </dl>

              <div className="mt-6 flex items-end justify-between gap-4 border-t border-[var(--m-line)] pt-5">
                <span className="m-eyebrow">Grand total</span>
                <span
                  // Keyed on the value so the figure replays its settle
                  // animation whenever any input changes it.
                  key={grand}
                  className="m-display m-tabular animate-[settle_0.45s_ease-out] text-[clamp(1.5rem,3vw,2rem)]"
                >
                  {fmtRupees(grand)}
                </span>
              </div>

              <p className="m-dim-2 mt-6 flex items-start gap-2 text-[11.5px] leading-relaxed">
                <Info className="mt-px size-3.5 shrink-0 text-[var(--m-gold)]" aria-hidden />
                <span>
                  {interState
                    ? 'Between two states, only IGST applies. A voucher with IGST and CGST or SGST on it together is refused before you can submit it.'
                    : 'Inside one state, CGST and SGST take half the rate each, and IGST stays empty.'}
                </span>
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ── Control chrome ──────────────────────────────────────────────────────── */

function Control({
  label,
  hint,
  value,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  value?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          {Icon && <Icon className="size-3.5 text-[var(--m-dim-2)]" />}
          {label}
        </span>
        {value && <span className="m-tabular text-[14px] font-semibold">{value}</span>}
      </div>
      {children}
      {hint && <p className="m-dim-2 mt-2 text-[11px]">{hint}</p>}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-xl border border-[var(--m-line)] bg-white/[0.03] p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition',
              active ? 'text-[var(--m-on-grad)]' : 'm-dim hover:text-[var(--m-ink)]',
            )}
            style={active ? { backgroundImage: 'var(--m-grad)' } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'm-mono rounded-lg border px-3 py-1.5 text-[11.5px] transition',
        active
          ? 'border-[color-mix(in_oklab,var(--m-gold)_50%,transparent)] bg-[color-mix(in_oklab,var(--m-gold)_12%,transparent)] text-[var(--m-gold)]'
          : 'm-dim border-[var(--m-line)] hover:border-[var(--m-line-2)] hover:text-[var(--m-ink)]',
      )}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  strong,
  dead,
}: {
  label: string;
  value: string;
  strong?: boolean;
  dead?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={cn(
          'text-[12.5px] transition-colors',
          dead ? 'text-[var(--m-dim-2)] line-through decoration-1' : 'm-dim',
          strong && 'font-medium text-[var(--m-ink)]',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'm-tabular text-[13px] transition-colors',
          dead ? 'text-[var(--m-dim-2)] line-through decoration-1' : 'text-[var(--m-ink)]',
          strong && 'font-semibold',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

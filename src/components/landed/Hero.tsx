'use client';

import { useState, type CSSProperties } from 'react';
import { CalendarClock, Hourglass, Ruler } from 'lucide-react';
import type { LandedCost } from '@/lib/landed/calc';
import { formatINR } from '@/lib/recon/amount';
import { TONE, compactINR, longDate, pct, todayIso, untilOc } from './shared';

/**
 * The answer, set the way the public site sets its heroes: one figure, large,
 * standing beside an arch with the sun in it.
 *
 * Under the figure is the sum that produced it — paid, plus carrying cost,
 * equals landed — and the bar that says how much of the landed cost came from
 * each place. The arch is decoration and is hidden from assistive technology;
 * everything it might seem to say is said in text beside it.
 */
export function Hero({
  name,
  ocDate,
  result,
}: {
  name: string;
  ocDate: string;
  result: LandedCost;
}) {
  // Safe to read the clock here: this only ever renders in the browser, after
  // the saved schedules have been read, so there is no server render for it to
  // disagree with. Read once, so a figure does not change under the reader.
  const [today] = useState(todayIso);
  const when = untilOc(ocDate, today);

  const parts = [
    { key: 'self', label: 'Own funds', value: result.self.paid, tone: TONE.self },
    { key: 'borrowed', label: 'Borrowed funds', value: result.borrowed.paid, tone: TONE.borrowed },
    { key: 'carry', label: 'Carrying cost', value: result.interest, tone: TONE.carry },
  ].filter((p) => p.value > 0);

  return (
    <section
      aria-labelledby="lc-hero"
      className="surface-lit a-ring relative isolate overflow-hidden rounded-[2rem]"
    >
      {/* Warm light behind the figure, in the carrying cost's own colour. */}
      <span
        aria-hidden
        className="a-orb -top-40 -left-24 size-[34rem] opacity-[0.16]"
        style={{ background: `radial-gradient(circle, ${TONE.carry}, transparent 66%)` }}
      />

      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="a-label">Landed cost at possession</span>
            {when && (
              <span
                style={{ '--tone': when.past ? 'var(--status-approved)' : TONE.carry } as CSSProperties}
                className="tinted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold"
              >
                <CalendarClock className="size-3" aria-hidden />
                Possession {when.phrase}
              </span>
            )}
          </div>

          <h2
            id="lc-hero"
            className="mt-4 animate-[settle_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards] text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.035em] text-balance"
          >
            {formatINR(result.landed)}
          </h2>
          <p className="text-muted mt-3 text-[15px]">
            {name.trim() || 'Untitled property'} · OC on {longDate(ocDate)}
          </p>

          {/* The sum, written out. */}
          <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch sm:gap-3">
            <Term label="Paid" value={result.paid} note={`${result.rows.length} payment${result.rows.length === 1 ? '' : 's'}`} />
            <Op>+</Op>
            <Term
              label="Carrying cost"
              short="Carrying"
              value={result.interest}
              note={`${pct(result.upliftPct)} on top`}
              tone={TONE.carry}
            />
            <Op>=</Op>
            <Term label="Landed" value={result.landed} note="at possession" strong />
          </div>

          {/* Where it came from: one bar, three parts, a 2px gap between them. */}
          {parts.length > 0 && (
            <div className="mt-8">
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
                {parts.map((p, i) => (
                  <span
                    key={p.key}
                    title={`${p.label}: ${formatINR(p.value)}`}
                    className="h-full origin-left animate-[grow_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards]"
                    style={{
                      flexGrow: p.value,
                      flexBasis: 0,
                      background: p.tone,
                      animationDelay: `${150 + i * 120}ms`,
                    }}
                  />
                ))}
              </div>
              <dl className="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                {parts.map((p) => (
                  <div key={p.key} className="flex items-baseline justify-between gap-3 sm:block">
                    <dt className="text-muted inline-flex items-center gap-2">
                      <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: p.tone }} />
                      {p.label}
                    </dt>
                    <dd className="mt-0.5 font-semibold tabular-nums sm:pl-[1.125rem]">
                      {compactINR(p.value)}{' '}
                      <span className="text-subtle font-normal">
                        · {pct(Math.round((p.value / result.landed) * 1000) / 10)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            <Chip icon={Hourglass}>
              Each rupee waited {Math.round(result.weightedDays).toLocaleString('en-IN')} days on average
            </Chip>
            {result.perSqft && (
              <Chip icon={Ruler}>
                {formatINR(result.perSqft.landed)} / sq ft landed, against {formatINR(result.perSqft.paid)} paid
              </Chip>
            )}
          </div>
        </div>

        <ArchWindow uplift={result.upliftPct} />
      </div>
    </section>
  );
}

function Term({
  label,
  short,
  value,
  note,
  tone,
  strong,
}: {
  label: string;
  /** What the label says on a phone, where three tiles share 300px. */
  short?: string;
  value: number;
  note: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? 'min-w-0 rounded-2xl bg-[var(--action)] px-3 py-3 text-[var(--on-action)] shadow-[var(--elev-brand)] sm:px-4 sm:py-3.5'
          : 'surface-sunken min-w-0 rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5'
      }
    >
      <p className={strong ? 'truncate text-[10px] font-semibold tracking-[0.12em] uppercase opacity-75' : 'a-label truncate'}>
        <span className="inline-flex items-center gap-1.5">
          {tone && <span aria-hidden className="hidden size-2 rounded-full sm:inline-block" style={{ background: tone }} />}
          {short ? (
            <>
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
        </span>
      </p>
      <p className="mt-1.5 truncate text-[1rem] font-semibold tracking-tight tabular-nums sm:text-[1.15rem]">{compactINR(value)}</p>
      <p className={strong ? 'mt-0.5 text-[11.5px] leading-snug opacity-75 sm:text-[12px]' : 'text-subtle mt-0.5 text-[11.5px] leading-snug sm:text-[12px]'}>{note}</p>
    </div>
  );
}

function Op({ children }: { children: string }) {
  return (
    <span aria-hidden className="text-subtle hidden place-items-center text-xl font-light sm:grid">
      {children}
    </span>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Ruler; children: React.ReactNode }) {
  return (
    <span className="surface-sunken text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/**
 * The public site's arch, with a building going up inside it and the sun
 * rising behind. The uplift is the one figure set on it, as a seal at the foot;
 * it is also in the sentence beside the hero, so the picture adds nothing a
 * screen reader misses.
 */
function ArchWindow({ uplift }: { uplift: number }) {
  return (
    <div aria-hidden className="relative hidden min-h-[19rem] lg:block">
      <div className="m-arch m-arch-open absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-[var(--surface-sunken)]">
        <span
          className="m-sun absolute top-[18%] left-1/2 size-36 -translate-x-1/2 xl:size-44"
          style={{ background: 'var(--color-gold-400)', ['--sun-from' as string]: '90px' }}
        />
        {/* A tower under construction: storeys, a crane, a dune at the foot. */}
        <svg viewBox="0 0 200 220" className="absolute inset-x-0 bottom-0 w-full" preserveAspectRatio="xMidYMax meet">
          <path d="M0 196 C 50 178, 120 186, 200 172 L200 220 L0 220 Z" fill="var(--border-strong)" opacity="0.55" />
          <g className="animate-[rise_1.2s_cubic-bezier(0.22,1,0.36,1)_0.5s_backwards]">
            <rect x="66" y="78" width="62" height="122" rx="2" fill="var(--text-c)" opacity="0.9" />
            {Array.from({ length: 7 }, (_, row) =>
              Array.from({ length: 3 }, (_, col) => (
                <rect
                  key={`${row}-${col}`}
                  x={74 + col * 17}
                  y={88 + row * 15}
                  width="10"
                  height="8"
                  rx="1"
                  fill="var(--color-gold-400)"
                  opacity={row < 2 ? 0.25 : 0.85}
                />
              )),
            )}
            <rect x="128" y="120" width="30" height="80" rx="2" fill="var(--text-c)" opacity="0.7" />
            <rect x="40" y="134" width="26" height="66" rx="2" fill="var(--text-c)" opacity="0.6" />
            {/* The crane: it is still going up. */}
            <path d="M120 78 V 34 M 92 38 H 168 M120 38 L 160 38 L 120 52" stroke="var(--text-c)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M160 38 V 60" stroke="var(--text-c)" strokeWidth="1.5" />
            <rect x="155" y="60" width="10" height="7" fill="var(--lc-carry)" />
          </g>
        </svg>
      </div>
      <div className="surface-lit elev-3 absolute bottom-5 left-1/2 -translate-x-1/2 rounded-2xl border px-4 py-2.5 text-center whitespace-nowrap">
        <p className="text-[1.35rem] leading-none font-semibold tracking-tight tabular-nums" style={{ color: 'var(--accent)' }}>
          +{pct(Math.round(uplift * 100) / 100)}
        </p>
        <p className="text-subtle mt-1 text-[11px]">over the amount paid</p>
      </div>
    </div>
  );
}

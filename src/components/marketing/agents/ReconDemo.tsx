'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Play, RotateCcw } from 'lucide-react';
import { runReconDemo, type DemoPair } from '@/lib/recon/demo';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { Ledger, Txn } from '@/lib/recon/types';
import { cn } from '@/lib/utils';
import { Odometer } from '../play/Odometer';
import { celebrate } from '../play/confetti';
import { reducedMotion } from '../scroll';

/**
 * Ledger Reconciliation, working, on its own public page.
 *
 * The two books on screen are the sample ledgers the tool itself offers, and
 * pressing the button runs the real engine on them in the visitor's browser
 * (lib/recon/demo): the pairs it finds are drawn as lines from one book to the
 * other, one at a time, the two lines only one side has are marked, and the
 * statement it produces is set out underneath — starting balance, the two
 * additions, the other book's balance, nothing left over.
 *
 * Every figure, pairing and word of the answer comes from the engine's output,
 * none of it is written into this component, so the demo cannot claim more
 * than the tool does. Nothing is sent anywhere.
 *
 * Wide screens draw the pairing as lines across a gutter between the books.
 * On a phone the books stack, and each row says what it was paired with
 * instead. Under reduced motion the whole answer appears at once.
 */

const STEP_MS = 420;

type Phase = 'idle' | 'running' | 'done';

export function ReconDemo() {
  const demo = useMemo(() => runReconDemo(), []);
  const { books, bank, pairs, result } = demo;
  const statement = result.statement;

  const [phase, setPhase] = useState<Phase>('idle');
  const [shown, setShown] = useState(0);
  const timer = useRef<number | null>(null);

  // Pairs in the order the engine found them; one-sided lines last, so the
  // ones that agree are seen agreeing before the ones that do not.
  const order = useMemo(
    () => [...pairs].sort((x, y) => Number(x.category !== 'MATCHED') - Number(y.category !== 'MATCHED')),
    [pairs],
  );

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const run = useCallback(() => {
    stop();
    if (reducedMotion()) {
      setShown(order.length);
      setPhase('done');
      return;
    }
    setShown(0);
    setPhase('running');
    let n = 0;
    timer.current = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= order.length) {
        stop();
        window.setTimeout(() => setPhase('done'), 450);
      }
    }, STEP_MS);
  }, [order.length]);

  const reset = () => {
    stop();
    setShown(0);
    setPhase('idle');
  };

  const revealed = order.slice(0, shown);
  const stateA = new Map<number, DemoPair>();
  const stateB = new Map<number, DemoPair>();
  revealed.forEach((p) => {
    if (p.a !== null) stateA.set(p.a, p);
    if (p.b !== null) stateB.set(p.b, p);
  });

  // The answer arriving is the moment the demo exists for.
  const agreed = statement.status === 'RECONCILED';
  const outcome = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === 'done' && agreed) celebrate(outcome.current?.querySelector('h3'), 60);
  }, [phase, agreed]);

  /* ── The lines between the books (wide screens) ── */
  const stage = useRef<HTMLDivElement>(null);
  const rowsA = useRef<(HTMLLIElement | null)[]>([]);
  const rowsB = useRef<(HTMLLIElement | null)[]>([]);
  const [paths, setPaths] = useState<{ d: string; key: string; pair: DemoPair }[]>([]);

  const measure = useCallback(() => {
    const host = stage.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const next: { d: string; key: string; pair: DemoPair }[] = [];
    for (const p of order) {
      if (p.a === null || p.b === null) continue;
      const ra = rowsA.current[p.a]?.getBoundingClientRect();
      const rb = rowsB.current[p.b]?.getBoundingClientRect();
      if (!ra || !rb || ra.width === 0) continue;
      const x1 = ra.right - box.left;
      const y1 = ra.top + ra.height / 2 - box.top;
      const x2 = rb.left - box.left;
      const y2 = rb.top + rb.height / 2 - box.top;
      const mid = (x1 + x2) / 2;
      next.push({ d: `M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`, key: `${p.a}-${p.b}`, pair: p });
    }
    setPaths(next);
  }, [order]);

  // Re-measured as rows are marked too: a row that gains its "only here" tag
  // grows, and every row below it moves.
  useLayoutEffect(measure, [measure, shown]);
  useLayoutEffect(() => {
    measure();
    const host = stage.current;
    if (!host) return;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="m-card relative overflow-hidden rounded-[2rem] p-5 sm:p-8 lg:p-10">
      {/* ── The control ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="m-dim max-w-xl t-3">
          A company&apos;s books and its bank statement for April 2026, written from opposite sides.
          The same engine the tool runs matches them here, in your browser. Nothing is uploaded.
        </p>
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={run}
            className="m-flood group inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--m-ink)] px-7 t-3 font-semibold text-[var(--m-on-grad)] shadow-[0_14px_28px_-16px_rgb(43_33_27_/_0.7)] active:scale-[0.985]"
          >
            <Play className="size-4 fill-current" aria-hidden />
            Reconcile them
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            disabled={phase === 'running'}
            className="m-flood group inline-flex h-12 items-center gap-2.5 rounded-full border-[1.5px] border-[var(--m-ink)] px-7 t-3 font-semibold text-[var(--m-ink)] [--flood:var(--m-ink)] enabled:hover:text-[var(--m-on-grad)] disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden />
            Run it again
          </button>
        )}
      </div>

      {/* ── The two books, and the lines between them ── */}
      <div
        ref={stage}
        className={cn(
          'r-demo relative mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] lg:gap-0',
          phase === 'running' && 'is-running',
        )}
      >
        <Book
          ledger={books}
          title="Company books"
          side="A"
          states={stateA}
          other="bank statement"
          rowsRef={rowsA}
        />
        <div aria-hidden className="hidden lg:block" />
        <Book
          ledger={bank}
          title="Bank statement"
          side="B"
          states={stateB}
          other="company books"
          rowsRef={rowsB}
        />

        <svg aria-hidden className="pointer-events-none absolute inset-0 hidden size-full overflow-visible lg:block">
          {paths.map(({ d, key, pair }) => {
            const on = revealed.includes(pair);
            return (
              <g key={key} className={cn('r-link', on && 'is-on')}>
                <path d={d} pathLength={1} className="r-link-path" />
                {on && <circle r="3.5" className="r-link-dot"><animateMotion dur="0.5s" fill="freeze" path={d} /></circle>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── The answer ── */}
      <div aria-live="polite">
        {phase === 'done' && (
          <div ref={outcome} className="r-outcome mt-10 grid gap-8 border-t border-[var(--m-line)] pt-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <p className="m-eyebrow">Statement · as at {formatLedgerDate(statement.reconciliationDate)}</p>
              <h3 className="m-display mt-4 t-h3">
                {agreed ? (
                  <>
                    The two books <span className="m-grad-text">agree.</span>
                  </>
                ) : statement.status === 'PARTIAL' ? (
                  'The balances meet, but a file contradicts itself.'
                ) : (
                  'The two books do not agree.'
                )}
              </h3>
              <p className="m-dim mt-4 max-w-md t-3">
                {result.counts.MATCHED} lines paired off on their own. {statement.lines.length === 1 ? 'One is' : `${statement.lines.length} are`}{' '}
                only in one book, and {statement.lines.length === 1 ? 'it is' : 'each is'} set out below with the side it is
                on. That is the whole of the difference.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  data-signup=""
                  className="m-flood group inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--m-ink)] px-7 t-3 font-semibold text-[var(--m-on-grad)] active:scale-[0.985]"
                >
                  Try it with your own files
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </div>

            <dl className="m-card rounded-3xl p-5 sm:p-7">
              <Line label={`Balance per ${lower(statement.startingLedgerName)}`} value={`${formatINR(statement.startingBalance)} ${statement.startingBalanceType}`} strong />
              {statement.lines.map((l, k) => (
                <Line
                  key={k}
                  label={
                    <>
                      <span className="m-dim-2">{l.operation === 'add' ? 'Add' : 'Less'}:</span>{' '}
                      {/* The engine words these "Entry only in Ledger A: …"; the
                          side is said in plain words after, by name. */}
                      {l.description.replace(/^Entry only in Ledger [AB]:\s*/, '')}{' '}
                      <span className="m-dim-2">
                        (only in the {l.sourceLedger === 'A' ? lower(statement.startingLedgerName) : lower(statement.otherLedgerName)})
                      </span>
                    </>
                  }
                  value={formatINR(l.amount)}
                  delay={300 + k * 150}
                />
              ))}
              <Line
                label={`Balance per ${lower(statement.otherLedgerName)}`}
                value={`${formatINR(statement.calculatedClosing)} ${statement.targetClosingType}`}
                strong
                delay={700}
              />
              <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[var(--m-ink)] px-4 py-3.5 text-[var(--m-on-grad)]">
                <dt className="m-mono t-1 t-caps uppercase opacity-80">Left unexplained</dt>
                <dd className="m-display t-6">
                  {Math.abs(statement.variance) < 0.01 ? 'Nil' : formatINR(Math.abs(statement.variance))}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function lower(name: string) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function Line({
  label,
  value,
  strong = false,
  delay = 0,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  delay?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--m-line)] py-3 last-of-type:border-0">
      <dt className={cn('min-w-0 t-3', strong ? 'font-semibold text-[var(--m-ink)]' : 'm-dim')}>{label}</dt>
      <dd className={cn('shrink-0 tabular-nums t-3', strong && 'font-semibold')}>
        <Odometer value={value} roll="load" delay={delay} />
      </dd>
    </div>
  );
}

function amountOf(t: Txn) {
  return t.debit > 0 ? `${formatINR(t.debit)} Dr` : `${formatINR(t.credit)} Cr`;
}

function Book({
  ledger,
  title,
  side,
  states,
  other,
  rowsRef,
}: {
  ledger: Ledger;
  title: string;
  side: 'A' | 'B';
  states: Map<number, DemoPair>;
  other: string;
  rowsRef: React.RefObject<(HTMLLIElement | null)[]>;
}) {
  const open = ledger.openingBalance;
  return (
    <section aria-label={title} className="r-book relative min-w-0 overflow-hidden rounded-3xl border border-[var(--m-line)] bg-[var(--m-bg)]">
      <span aria-hidden className="r-scan" />
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--m-line)] px-4 py-3.5 sm:px-5">
        <h3 className="m-display t-5">{title}</h3>
        <span className="m-mono m-dim-2 t-1 t-caps uppercase">
          Opening {formatINR(Math.abs(open))} {open >= 0 ? 'Dr' : 'Cr'}
        </span>
      </header>
      <ol>
        {ledger.transactions.map((t, i) => {
          const s = states.get(i);
          const matched = s?.category === 'MATCHED';
          const only = s && (side === 'A' ? s.b === null : s.a === null);
          return (
            <li
              key={i}
              ref={(el) => {
                rowsRef.current[i] = el;
              }}
              className={cn(
                'r-row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 border-b border-[var(--m-line)] px-4 py-2.5 last:border-0 sm:px-5',
                matched && 'is-matched',
                only && 'is-only',
              )}
            >
              {/* The date over the description rather than beside it, so the
                  description keeps the width to be read in full on a phone. */}
              <span className="min-w-0">
                <span className="m-dim-2 block t-1 tabular-nums">{formatLedgerDate(t.date)}</span>
                <span className="block t-3 text-[var(--m-ink)]">{t.particular}</span>
              </span>
              <span className="t-3 tabular-nums">{amountOf(t)}</span>
              {/* On a phone there is no gutter to draw a line across, so the
                  row says what became of it instead. */}
              {(matched || only) && (
                <span className="r-tag col-span-2 lg:hidden">
                  {matched ? `Paired with the ${other}` : `Only in the ${title.toLowerCase()}`}
                </span>
              )}
              {only && <span className="r-tag col-span-2 hidden lg:inline-flex">Only here</span>}
            </li>
          );
        })}
      </ol>
      <footer className="flex items-baseline justify-between gap-3 border-t border-[var(--m-line)] px-4 py-3 sm:px-5">
        <span className="m-mono m-dim-2 t-1 t-caps uppercase">Closing per file</span>
        <span className="t-3 font-semibold tabular-nums">
          {ledger.closingBalance === null
            ? '—'
            : `${formatINR(Math.abs(ledger.closingBalance))} ${ledger.closingBalance >= 0 ? 'Dr' : 'Cr'}`}
        </span>
      </footer>
    </section>
  );
}

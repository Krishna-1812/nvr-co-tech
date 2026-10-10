'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, Building, Download, Landmark, Plus, Trash2, Wallet, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import {
  Button,
  Card,
  CardTitle,
  DataTable,
  Field,
  Input,
  Select,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/recon/amount';
import {
  COMPOUNDING_LABEL,
  SOURCE_LABEL,
  landedCost,
  parseAmount,
  problems,
  type Compounding,
  type FundSource,
  type Instalment,
} from '@/lib/landed/calc';
import {
  blankInstalment,
  landedStore,
  useLandedStore,
  type SavedSchedule,
} from '@/lib/landed/store';

/**
 * Landed Cost: what an under-construction property costs by possession.
 *
 * One screen, three parts in the order somebody fills them in: the property and
 * its OC date, what the money costs, and the payments. The answer sits under
 * them and recomputes on every keystroke, because the useful question here is
 * "what if" — what if the OC slips six months, what if the next demand comes
 * from the loan instead — and a Calculate button would make every one of those
 * a round trip.
 *
 * Every edit is saved to this browser as it is made. See lib/landed/store for
 * why nothing leaves it.
 */

const SOURCE_TONE: Record<FundSource, string> = {
  self: 'var(--h-emerald)',
  borrowed: 'var(--h-indigo)',
};

const SOURCE_ICON = { self: Wallet, borrowed: Landmark } as const;

/** 1 Mar 2027, read in UTC so the calendar date is the one that was typed. */
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

const pct = (x: number) => `${x.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

export function LandedWorkbench() {
  const state = useLandedStore();

  // A first visit has nothing saved. Start one rather than show an empty screen
  // with a button whose only job is to make the screen not empty.
  useEffect(() => {
    if (state && state.schedules.length === 0) landedStore.ensureOne();
  }, [state]);

  const active = state?.schedules.find((s) => s.id === state.activeId) ?? null;

  if (!state || !active) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader eyebrow="Landed Cost" title="Landed cost to possession" />
        <Card className="h-64 animate-[shimmer_1.8s_ease-in-out_infinite]" />
      </div>
    );
  }

  return <Editor key={active.id} schedule={active} all={state.schedules} />;
}

function Editor({ schedule, all }: { schedule: SavedSchedule; all: SavedSchedule[] }) {
  const save = (patch: Partial<SavedSchedule>) => landedStore.save({ ...schedule, ...patch });
  const setRow = (id: string, patch: Partial<Instalment>) =>
    save({ instalments: schedule.instalments.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  const result = useMemo(() => landedCost(schedule), [schedule]);
  const issues = useMemo(() => problems(schedule), [schedule]);
  const badRows = new Set(issues.map((p) => p.id).filter(Boolean));
  const ready = result.rows.length > 0 && !!schedule.ocDate && !issues.some((p) => !p.id);

  const [exporting, setExporting] = useState(false);
  const download = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const { buildLandedWorkbook } = await import('@/lib/landed/workbook');
      const book = buildLandedWorkbook(XLSX, schedule);
      const safe = schedule.name.replace(/[^\w\- ]+/g, '').trim() || 'Landed cost';
      XLSX.writeFile(book, `${safe} - landed cost.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const remove = () => {
    if (window.confirm(`Delete "${schedule.name}"? It is only saved in this browser, so it cannot be recovered.`)) {
      landedStore.remove(schedule.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Landed Cost"
        title={schedule.name.trim() || 'Untitled property'}
        description="Every instalment on an under-construction property, plus what the money cost while it was tied up, up to the day of the occupancy certificate."
        action={
          <>
            {all.length > 1 && (
              <Select
                aria-label="Open a saved schedule"
                value={schedule.id}
                onChange={(e) => landedStore.open(e.target.value)}
                className="w-auto max-w-56"
              >
                {all.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.trim() || 'Untitled property'}
                  </option>
                ))}
              </Select>
            )}
            <Button onClick={() => landedStore.create()}>
              <Plus className="size-4" aria-hidden />
              New property
            </Button>
            <Button variant="primary" onClick={download} disabled={!ready} loading={exporting}>
              <Download className="size-4" aria-hidden />
              Excel
            </Button>
          </>
        }
      />

      {/* ── The property, and what money costs ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle
            icon={<Building className="size-3.5" />}
            title="The property"
            description="Interest on every payment runs up to the OC date."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="lc-name" className="sm:col-span-2">
              <Input
                id="lc-name"
                value={schedule.name}
                onChange={(e) => save({ name: e.target.value })}
                placeholder="Tower B, Flat 1204"
                autoComplete="off"
              />
            </Field>
            <Field
              label="OC / possession date"
              htmlFor="lc-oc"
              required
              hint={schedule.ocDate ? longDate(schedule.ocDate) : 'Expected date if not yet issued'}
            >
              <Input
                id="lc-oc"
                type="date"
                value={schedule.ocDate}
                onChange={(e) => save({ ocDate: e.target.value })}
              />
            </Field>
            <Field label="Carpet area (sq ft)" htmlFor="lc-area" hint="Optional, for a cost per sq ft">
              <NumberInput
                id="lc-area"
                value={schedule.areaSqft}
                onCommit={(v) => save({ areaSqft: v })}
                placeholder="1,050"
              />
            </Field>
          </div>
          <div className="flex justify-end border-t px-5 py-3">
            <button
              type="button"
              onClick={remove}
              className="text-subtle inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition hover:text-[var(--status-rejected)]"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete this property
            </button>
          </div>
        </Card>

        <Card>
          <CardTitle
            icon={<Wallet className="size-3.5" />}
            title="Cost of funds"
            description="One rate per source, applied to every payment made from it."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Own funds (% a year)" htmlFor="lc-self" hint="What the money would have earned">
              <NumberInput
                id="lc-self"
                value={schedule.rates.self}
                onCommit={(v) => save({ rates: { ...schedule.rates, self: v ?? 0 } })}
                suffix="%"
              />
            </Field>
            <Field label="Borrowed funds (% a year)" htmlFor="lc-borrowed" hint="The loan's interest rate">
              <NumberInput
                id="lc-borrowed"
                value={schedule.rates.borrowed}
                onCommit={(v) => save({ rates: { ...schedule.rates, borrowed: v ?? 0 } })}
                suffix="%"
              />
            </Field>
            <Field
              label="Interest method"
              htmlFor="lc-method"
              className="sm:col-span-2"
              hint="Days counted actual/365. Simple interest is how pre-EMI interest is charged."
            >
              <Select
                id="lc-method"
                value={schedule.compounding}
                onChange={(e) => save({ compounding: e.target.value as Compounding })}
              >
                {(Object.keys(COMPOUNDING_LABEL) as Compounding[]).map((c) => (
                  <option key={c} value={c}>
                    {COMPOUNDING_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      </div>

      {/* ── The payments ── */}
      <Card>
        <CardTitle
          icon={<Landmark className="size-3.5" />}
          title="Down payment and instalments"
          description="Each payment as it was made, or as the builder's demand schedule says it will be."
        />

        <div className="hidden grid-cols-[minmax(0,1.5fr)_10.5rem_11rem_14.5rem_2.25rem] gap-3 border-b px-5 py-2 md:grid">
          {['Payment', 'Date paid', 'Amount (₹)', 'Source of funds', ''].map((h) => (
            <span key={h} className="a-label">
              {h}
            </span>
          ))}
        </div>

        <ol className="divide-y">
          {schedule.instalments.map((row, n) => (
            <li
              key={row.id}
              className={cn(
                'grid grid-cols-2 gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.5fr)_10.5rem_11rem_14.5rem_2.25rem] md:items-center md:py-3',
                badRows.has(row.id) && 'bg-[color-mix(in_oklab,var(--status-warn)_6%,transparent)]',
              )}
            >
              <Input
                aria-label={`Payment ${n + 1} description`}
                value={row.label}
                onChange={(e) => setRow(row.id, { label: e.target.value })}
                placeholder={n === 0 ? 'Booking amount' : `Instalment ${n}`}
                className="col-span-2 md:col-span-1"
              />
              <Input
                aria-label={`Payment ${n + 1} date`}
                type="date"
                value={row.date}
                onChange={(e) => setRow(row.id, { date: e.target.value })}
              />
              <NumberInput
                aria-label={`Payment ${n + 1} amount in rupees`}
                value={row.amount || undefined}
                onCommit={(v) => setRow(row.id, { amount: v ?? 0 })}
                placeholder="0"
              />
              <SourceToggle
                value={row.source}
                onChange={(source) => setRow(row.id, { source })}
                label={`Payment ${n + 1} source of funds`}
              />
              <button
                type="button"
                onClick={() => save({ instalments: schedule.instalments.filter((i) => i.id !== row.id) })}
                aria-label={`Remove payment ${n + 1}`}
                className="text-subtle grid size-10 place-items-center justify-self-end rounded-full transition hover:bg-[var(--surface-sunken)] hover:text-[var(--status-rejected)] md:size-9"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
          <Button
            size="sm"
            onClick={() => {
              const last = schedule.instalments.at(-1);
              save({ instalments: [...schedule.instalments, blankInstalment(last?.source ?? 'self')] });
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            Add payment
          </Button>
          <p className="text-muted text-sm">
            {result.rows.length} of {schedule.instalments.length} counted ·{' '}
            <span className="amount font-semibold text-[var(--text-c)]">{formatINR(result.paid)}</span>
          </p>
        </div>

        {issues.length > 0 && (
          <div
            style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
            className="tinted mx-5 mb-5 rounded-xl border px-4 py-3 text-sm"
            role="status"
          >
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Not counted yet
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
              {issues.map((p, i) => (
                <li key={i}>{p.message}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {ready ? (
        <Result schedule={schedule} result={result} />
      ) : schedule.instalments.length === 0 ? (
        <p className="text-muted rounded-2xl border border-dashed px-5 py-8 text-center text-sm">
          Add the down payment and each instalment to see the landed cost at possession.
        </p>
      ) : null}
    </div>
  );
}

function Result({
  schedule,
  result,
}: {
  schedule: SavedSchedule;
  result: ReturnType<typeof landedCost>;
}) {
  const maxInterest = Math.max(...result.rows.map((r) => r.interest), 0);
  const afterOc = result.rows.filter((r) => r.afterOc).length;

  return (
    <section aria-labelledby="lc-result" className="space-y-6">
      {/* ── The answer ── */}
      <Card className="overflow-hidden rounded-3xl">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <p className="a-label">Landed cost at possession · {longDate(schedule.ocDate)}</p>
            <h2 id="lc-result" className="amount mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-none font-bold">
              {formatINR(result.landed)}
            </h2>
            <p className="text-muted mt-4 max-w-xl text-[15px] text-pretty">
              <span className="font-semibold text-[var(--text-c)]">{formatINR(result.paid)}</span> paid, plus{' '}
              <span className="font-semibold text-[var(--accent)]">{formatINR(result.interest)}</span> it cost to
              have that money tied up until the OC date. That is {pct(result.upliftPct)} on top of what was
              paid, with each rupee waiting {Math.round(result.weightedDays).toLocaleString('en-IN')} days on
              average.
            </p>
          </div>

          {result.perSqft && (
            <dl className="surface-sunken grid grid-cols-2 gap-4 rounded-2xl border p-4 sm:min-w-72">
              <div>
                <dt className="a-label">Paid / sq ft</dt>
                <dd className="amount mt-1.5 text-lg font-semibold">{formatINR(result.perSqft.paid)}</dd>
              </div>
              <div>
                <dt className="a-label">Landed / sq ft</dt>
                <dd className="amount mt-1.5 text-lg font-semibold text-[var(--accent)]">
                  {formatINR(result.perSqft.landed)}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Where the carrying cost came from, as one bar. */}
        {result.interest > 0 && (
          <div className="border-t px-6 py-4 sm:px-8">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--a-track)]">
              {(['self', 'borrowed'] as const).map((s) =>
                result[s].interest > 0 ? (
                  <span
                    key={s}
                    style={{ width: `${(result[s].interest / result.interest) * 100}%`, background: SOURCE_TONE[s] }}
                  />
                ) : null,
              )}
            </div>
          </div>
        )}

        <div className="grid border-t sm:grid-cols-2 sm:divide-x">
          {(['self', 'borrowed'] as const).map((s) => {
            const Icon = SOURCE_ICON[s];
            return (
              <div key={s} className="flex items-start gap-3 p-5 sm:px-8">
                <span
                  aria-hidden
                  style={{ '--tone': SOURCE_TONE[s] } as CSSProperties}
                  className="tinted grid size-9 shrink-0 place-items-center rounded-xl border"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="a-label" style={{ color: SOURCE_TONE[s] }}>
                    {SOURCE_LABEL[s]} at {pct(schedule.rates[s])} a year
                  </p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">Paid</dt>
                      <dd className="amount font-semibold">{formatINR(result[s].paid)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">{s === 'self' ? 'Return given up' : 'Interest to OC'}</dt>
                      <dd className="amount font-semibold">{formatINR(result[s].interest)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Payment by payment ── */}
      <Card className="overflow-hidden">
        <CardTitle
          title="Payment by payment"
          description={`${COMPOUNDING_LABEL[schedule.compounding]}, days counted actual/365 to ${longDate(schedule.ocDate)}.`}
        />
        <DataTable>
          <Thead>
            <tr>
              <Th>Payment</Th>
              <Th>Date paid</Th>
              <Th>Source</Th>
              <Th align="right">Amount</Th>
              <Th align="right">Days to OC</Th>
              <Th align="right">Rate</Th>
              <Th align="right">Carrying cost</Th>
              <Th align="right">Value at OC</Th>
            </tr>
          </Thead>
          <tbody className="divide-y">
            {result.rows.map((r) => (
              <Tr key={r.id}>
                <Td className="max-w-64 truncate font-medium">{r.name}</Td>
                <Td className="whitespace-nowrap">{longDate(r.date)}</Td>
                <Td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: SOURCE_TONE[r.source] }} />
                    {SOURCE_LABEL[r.source]}
                  </span>
                </Td>
                <Td align="right" className="numeric whitespace-nowrap">
                  {formatINR(r.amount)}
                </Td>
                <Td align="right" className="numeric whitespace-nowrap">
                  {r.afterOc ? <span className="text-subtle">After OC</span> : r.days.toLocaleString('en-IN')}
                </Td>
                <Td align="right" className="numeric whitespace-nowrap">
                  {pct(r.rate)}
                </Td>
                <Td align="right" className="numeric whitespace-nowrap">
                  <span className="block">{formatINR(r.interest)}</span>
                  {maxInterest > 0 && (
                    <span className="mt-1 ml-auto block h-[3px] w-20 overflow-hidden rounded-full bg-[var(--a-track)]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(r.interest / maxInterest) * 100}%`, background: SOURCE_TONE[r.source] }}
                      />
                    </span>
                  )}
                </Td>
                <Td align="right" className="numeric font-semibold whitespace-nowrap">
                  {formatINR(r.atPossession)}
                </Td>
              </Tr>
            ))}
          </tbody>
          <tfoot className="surface-sunken border-t font-semibold">
            <tr>
              <Td colSpan={3}>Total</Td>
              <Td align="right" className="numeric whitespace-nowrap">
                {formatINR(result.paid)}
              </Td>
              <Td colSpan={2} />
              <Td align="right" className="numeric whitespace-nowrap text-[var(--accent)]">
                {formatINR(result.interest)}
              </Td>
              <Td align="right" className="numeric whitespace-nowrap">
                {formatINR(result.landed)}
              </Td>
            </tr>
          </tfoot>
        </DataTable>
        {afterOc > 0 && (
          <p className="text-subtle border-t px-5 py-3 text-xs">
            {afterOc === 1 ? 'One payment falls' : `${afterOc} payments fall`} on or after the OC date, so{' '}
            {afterOc === 1 ? 'it carries' : 'they carry'} no cost of funds. Check the date if that is not what
            happened.
          </p>
        )}
      </Card>

      <p className="text-subtle text-xs">
        Saved in this browser only. Nothing on this page is sent to a server; use Excel to keep a copy
        elsewhere.
      </p>
    </section>
  );
}

/** Own funds or borrowed, as a two-way switch rather than a dropdown of two. */
function SourceToggle({
  value,
  onChange,
  label,
}: {
  value: FundSource;
  onChange: (v: FundSource) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="surface-sunken grid grid-cols-2 gap-1 rounded-full border p-1"
      // A radio group is one tab stop, moved through with the arrow keys.
      onKeyDown={(e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const next: FundSource = value === 'self' ? 'borrowed' : 'self';
        onChange(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-source="${next}"]`)?.focus();
      }}
    >
      {(['self', 'borrowed'] as const).map((s) => {
        const on = value === s;
        const Icon = SOURCE_ICON[s];
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-source={s}
            onClick={() => onChange(s)}
            style={on ? ({ '--tone': SOURCE_TONE[s] } as CSSProperties) : undefined}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-full border text-[13px] font-semibold transition',
              on ? 'tinted' : 'text-muted border-transparent hover:text-[var(--text-c)]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {s === 'self' ? 'Own' : 'Borrowed'}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A number field that shows Indian grouping when you are not typing in it.
 *
 * Text rather than type="number", because a number input cannot hold "12,50,000"
 * and silently empties itself on a pasted figure with commas in it, which is how
 * every amount on a demand letter is written.
 */
function NumberInput({
  value,
  onCommit,
  suffix,
  className,
  ...rest
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  suffix?: string;
  className?: string;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const show = (v: number | undefined) =>
    v === undefined ? '' : v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const [text, setText] = useState(() => show(value));
  const [editing, setEditing] = useState(false);
  // Set when what is typed is not a number. The last good value is kept, and
  // the field says so rather than silently showing it again on blur.
  const [invalid, setInvalid] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <Input
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        value={editing ? text : show(value)}
        onFocus={() => {
          setText(value === undefined ? '' : String(value));
          setEditing(true);
        }}
        onBlur={() => {
          setEditing(false);
          setInvalid(false);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = parseAmount(raw);
          setInvalid(n === null);
          if (n !== null) onCommit(Number.isNaN(n) ? undefined : n);
        }}
        aria-invalid={invalid || undefined}
        className={cn(
          'numeric text-right',
          suffix && 'pr-8',
          // `color:` tells the class merger this is a border colour; a bare
          // var() reads to it as a width and the class was being dropped.
          invalid &&
            'border-[color:var(--status-rejected)] hover:border-[color:var(--status-rejected)] focus:border-[color:var(--status-rejected)]',
        )}
      />
      {suffix && (
        <span aria-hidden className="text-subtle pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm">
          {suffix}
        </span>
      )}
    </div>
  );
}

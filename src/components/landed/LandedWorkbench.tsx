'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { BookOpen, Building, Download, FileText, Lightbulb, LineChart, Plus, Table2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Button, DataTable, Td, Th, Thead, Tr } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/recon/amount';
import { COMPOUNDING_LABEL, SOURCE_LABEL, landedCost, problems, timeline, type LandedCost } from '@/lib/landed/calc';
import { bindLandedUser, landedStore, useLandedStore, type SavedSchedule } from '@/lib/landed/store';
import { METHOD, afterOcNote } from '@/lib/landed/words';
import { Hero } from './Hero';
import { MoneyChart } from './MoneyChart';
import { DelayPanel, FundsPanel, Panel, PropertyPanel } from './Panels';
import { Payments } from './Payments';
import { RentalPanel } from './Rental';
import { SOURCE_TONE, compactINR, longDate, pct } from './shared';

/**
 * True Property Cost: what an under-construction property costs by possession.
 *
 * The answer leads, because it recomputes on every keystroke and the useful
 * question here is "what if": the hero and the chart are what move when a date
 * or a source changes below them. Then the work itself, payments on the left
 * where most of the typing is, the property, the money and the delay control
 * beside them. The working sits at the foot, row by row, for anyone checking.
 *
 * Every edit is saved to this browser as it is made. See lib/landed/store for
 * why nothing leaves it.
 */
/**
 * A property name made safe to use as the start of a file name: letters and
 * digits in any script, spaces and hyphens. \w alone meant ASCII, so a name
 * typed in Hindi was emptied and every such property downloaded under the same
 * generic name.
 */
function fileBase(name: string): string {
  return name.replace(/[^\p{L}\p{M}\p{N}\- ]+/gu, '').replace(/ +/g, ' ').trim() || 'True property cost';
}

export function LandedWorkbench({ userId = null }: { userId?: string | null }) {
  bindLandedUser(userId);
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
        <PageHeader eyebrow="True Property Cost" title="True cost to possession" />
        <div className="surface-lit h-80 animate-[shimmer_1.8s_ease-in-out_infinite] rounded-[2rem]" />
      </div>
    );
  }

  return <Editor key={active.id} schedule={active} all={state.schedules} userId={userId} />;
}

function Editor({ schedule, all, userId }: { schedule: SavedSchedule; all: SavedSchedule[]; userId: string | null }) {
  const save = (patch: Partial<SavedSchedule>) => landedStore.save({ ...schedule, ...patch });

  const result = useMemo(() => landedCost(schedule), [schedule]);
  const points = useMemo(() => timeline(schedule), [schedule]);
  const issues = useMemo(() => problems(schedule), [schedule]);
  const ready = result.rows.length > 0 && !!schedule.ocDate && !issues.some((p) => !p.id);

  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const download = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const { buildLandedWorkbook } = await import('@/lib/landed/workbook');
      const book = buildLandedWorkbook(XLSX, schedule);
      XLSX.writeFile(book, `${fileBase(schedule.name)} - true property cost.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  /*
   * The PDF is drawn in the browser, like everything else here, so the schedule
   * still never leaves it. The renderer is large and only loaded on the click.
   */
  const downloadPdf = async () => {
    setPrinting(true);
    try {
      const [{ pdf }, { TruePropertyCostDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/lib/landed/report'),
      ]);
      const now = new Date();
      const preparedOn = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const blob = await pdf(<TruePropertyCostDocument schedule={schedule} preparedOn={preparedOn} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBase(schedule.name)} - true property cost.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="True Property Cost"
        title={schedule.name.trim() || 'Untitled property'}
        description="Every instalment on an under-construction property, plus what the money cost while it was tied up, up to the day of the occupancy certificate."
        action={
          <>
            <Button variant="ghost" onClick={() => landedStore.createExample()}>
              <Lightbulb className="size-4" aria-hidden />
              Load example
            </Button>
            <Button onClick={() => landedStore.create()}>
              <Plus className="size-4" aria-hidden />
              New property
            </Button>
            <Button onClick={downloadPdf} disabled={!ready} loading={printing}>
              <FileText className="size-4" aria-hidden />
              PDF
            </Button>
            <Button variant="primary" onClick={download} disabled={!ready} loading={exporting}>
              <Download className="size-4" aria-hidden />
              Excel
            </Button>
          </>
        }
      />

      {all.length > 1 && <PropertyStrip all={all} activeId={schedule.id} />}

      {ready ? (
        <Hero name={schedule.name} ocDate={schedule.ocDate} result={result} />
      ) : (
        <EmptyHero hasPayments={schedule.instalments.length > 0} />
      )}

      {ready && points.length > 1 && (
        <Panel
          icon={<LineChart className="size-4" />}
          title="Money tied up, over time"
          description="What had been paid from each source, and the carrying cost building on top of it, up to possession."
        >
          <div className="pb-4 sm:px-1">
            <MoneyChart points={points} rows={result.rows} ocDate={schedule.ocDate} />
          </div>
        </Panel>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Payments
          instalments={schedule.instalments}
          result={result}
          issues={issues}
          onChange={(instalments) => save({ instalments })}
        />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
          <PropertyPanel
            schedule={schedule}
            onChange={save}
            footer={
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-subtle inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition hover:text-[var(--status-rejected)]"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete this property
              </button>
            }
          />
          <FundsPanel schedule={schedule} onChange={save} />
          {ready && <DelayPanel schedule={schedule} />}
        </div>
      </div>

      {ready && <RentalPanel schedule={schedule} result={result} onChange={(rental) => save({ rental })} />}

      {ready && <Working schedule={schedule} result={result} />}

      <Method />

      <p className="text-subtle text-center text-xs">
        {userId
          ? 'Worked out in this browser and saved to your account, which only you can read. Use Excel to keep a copy elsewhere.'
          : 'Saved in this browser only. Nothing on this page is sent to a server; sign in to keep a copy in your account, or use Excel.'}
      </p>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete ${schedule.name.trim() || 'this property'}?`}
        description={
          userId
            ? 'It is removed from this browser and from your account, and cannot be recovered. Download the Excel first if you want a copy.'
            : 'It is saved only in this browser, so once it is deleted it cannot be recovered. Download the Excel first if you want a copy.'
        }
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)}>Keep it</Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(false);
              landedStore.remove(schedule.id);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Every saved property as a chip with its true cost, for switching between them.
 *
 * No `scroll-x-hint` here. That hint fades a scrolling edge by painting a block
 * of the card colour over it, which only disappears on a card; this strip sits
 * straight on the page's sand, so the block showed as a white bar at the right
 * end, scrolling or not. A chip cut off at the edge already says there is more.
 */
function PropertyStrip({ all, activeId }: { all: SavedSchedule[]; activeId: string }) {
  return (
    <nav aria-label="Saved properties" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {all.map((s) => {
        const on = s.id === activeId;
        const r = landedCost(s);
        return (
          <button
            key={s.id}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() => landedStore.open(s.id)}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition',
              on
                ? 'bg-[var(--action)] text-[var(--on-action)] shadow-[var(--elev-brand)]'
                : 'surface-lit hover:border-[var(--border-strong)]',
            )}
          >
            <Building className={cn('size-4 shrink-0', on ? 'opacity-80' : 'text-subtle')} aria-hidden />
            <span className="min-w-0">
              <span className="block max-w-48 truncate text-[13px] font-semibold">{s.name.trim() || 'Untitled property'}</span>
              <span className={cn('block text-[11.5px] tabular-nums', on ? 'opacity-75' : 'text-subtle')}>
                {r.rows.length > 0 && s.ocDate ? `${compactINR(r.landed)} true cost` : 'Not finished'}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Before there is an answer: what is missing, beside the same arch the answer will stand next to. */
function EmptyHero({ hasPayments }: { hasPayments: boolean }) {
  return (
    <section className="surface-lit a-ring relative overflow-hidden rounded-[2rem]">
      <div className="grid items-center gap-6 p-6 sm:p-9 md:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <p className="a-label">True cost at possession</p>
          <h2 className="m-display mt-3 text-[clamp(1.8rem,4vw,2.6rem)] text-balance">
            {hasPayments ? 'Almost there.' : 'Start with the booking amount.'}
          </h2>
          <p className="text-muted mt-3 max-w-lg text-[15px] text-pretty">
            {hasPayments
              ? 'Give each payment a date and an amount, and the property its OC date. The true cost appears here the moment there is enough to work it out.'
              : 'Add the down payment and each instalment below, with where the money came from. The true cost appears here as you type.'}
          </p>
        </div>
        <div aria-hidden className="relative mx-auto hidden h-44 w-36 md:block">
          <div className="m-arch m-arch-open absolute inset-0 overflow-hidden bg-[var(--surface-sunken)]">
            <span className="m-sun absolute top-8 left-1/2 size-20 -translate-x-1/2" style={{ background: 'var(--scene-sun)' }} />
            <span className="absolute inset-x-0 bottom-0 h-12 bg-[var(--border-strong)] opacity-50" style={{ borderRadius: '60% 40% 0 0 / 40% 30% 0 0' }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The method and its limits, stated where the figures are.
 *
 * A number with no visible method is a number nobody can sign off, and the
 * limits matter as much as the formula: the loan is assumed to stay fully
 * drawn until possession, which is the conservative reading, and tax is out of
 * scope entirely.
 */
function Method() {
  return (
    <Panel icon={<BookOpen className="size-4" />} title="How it is worked out" description="The method, and what it leaves out.">
      <div className="grid gap-6 p-5 text-[13.5px] sm:p-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="a-label">The cost of each payment</p>
          <p className="surface-sunken rounded-2xl border px-4 py-3 font-semibold tabular-nums">{METHOD.formula}</p>
          <ul className="text-muted list-disc space-y-1.5 pl-5 text-pretty">
            {METHOD.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <p className="a-label">What the figures mean</p>
          <ul className="text-muted list-disc space-y-1.5 pl-5 text-pretty">
            {METHOD.meanings.map(([term, meaning]) => (
              <li key={term}>
                <span className="font-semibold text-[var(--text-c)]">{term}</span>: {meaning}
              </li>
            ))}
          </ul>
          <p className="a-label pt-1">Not modelled</p>
          <p className="text-muted text-pretty">{METHOD.notModelled}</p>
        </div>
      </div>
    </Panel>
  );
}

/** The working, payment by payment: the table view every figure above can be checked against. */
function Working({ schedule, result }: { schedule: SavedSchedule; result: LandedCost }) {
  const maxInterest = Math.max(...result.rows.map((r) => r.interest), 0);
  const afterOc = result.rows.filter((r) => r.afterOc).length;

  return (
    <Panel
      icon={<Table2 className="size-4" />}
      title="Payment by payment"
      description={`${COMPOUNDING_LABEL[schedule.compounding]}, days counted actual/365 to ${longDate(schedule.ocDate)}.`}
    >
      <div className="mt-4 border-t">
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
                    <span aria-hidden className="size-2 rounded-full" style={{ background: SOURCE_TONE[r.source] }} />
                    {SOURCE_LABEL[r.source]}
                  </span>
                </Td>
                <Td align="right" className="numeric whitespace-nowrap">{formatINR(r.amount)}</Td>
                <Td align="right" className="numeric whitespace-nowrap">
                  {r.afterOc ? <span className="text-subtle">After OC</span> : r.days.toLocaleString('en-IN')}
                </Td>
                <Td align="right" className="numeric whitespace-nowrap">{pct(r.rate)}</Td>
                <Td align="right" className="numeric whitespace-nowrap">
                  <span className="block">{formatINR(r.interest)}</span>
                  {maxInterest > 0 && (
                    <span className="mt-1 ml-auto block h-[3px] w-20 overflow-hidden rounded-full bg-[var(--a-track)]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(r.interest / maxInterest) * 100}%`, background: 'var(--lc-carry)' } as CSSProperties}
                      />
                    </span>
                  )}
                </Td>
                <Td align="right" className="numeric font-semibold whitespace-nowrap">{formatINR(r.atPossession)}</Td>
              </Tr>
            ))}
          </tbody>
          <tfoot className="surface-sunken border-t font-semibold">
            <tr>
              <Td colSpan={3}>Total</Td>
              <Td align="right" className="numeric whitespace-nowrap">{formatINR(result.paid)}</Td>
              <Td colSpan={2} />
              <Td align="right" className="numeric whitespace-nowrap text-[var(--accent)]">{formatINR(result.interest)}</Td>
              <Td align="right" className="numeric whitespace-nowrap">{formatINR(result.landed)}</Td>
            </tr>
          </tfoot>
        </DataTable>
        {afterOc > 0 && (
          <p className="text-subtle border-t px-5 py-3 text-xs">{afterOcNote(afterOc)}</p>
        )}
      </div>
    </Panel>
  );
}

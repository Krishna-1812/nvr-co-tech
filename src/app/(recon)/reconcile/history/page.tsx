import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, History, Lock, Plus, Scale, ShieldCheck } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import { PageHeader } from '@/components/PageHeader';
import { buttonClass } from '@/components/ui/primitives';
import { HeroChip, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene } from '@/components/ui/Scene';
import { HistorySummary } from '@/components/recon/HistorySummary';
import { HistoryRow } from './HistoryRow';
import type { ReconciliationRow } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Reconciliation history' };

/** Everything the list renders. The stored statement itself is never fetched. */
type Row = Omit<ReconciliationRow, 'created_by' | 'result'>;

/**
 * Reconciliations you have kept.
 *
 * Yours only, and that is enforced by the database rather than by this query.
 * Unlike a voucher, a reconciliation is working paper: nobody approves it and
 * nobody else has a reason to read it, so 0008 gives the table no policy that
 * would let one person see another's.
 *
 * The list is rendered from the columns beside the stored statement rather than
 * from the statement itself, so opening this page does not mean deserialising
 * every reconciliation anybody has ever run.
 */
export default async function HistoryPage() {
  const user = await requireUser();
  const supabase = await createClient();

  /*
   * One string literal, not a concatenation. PostgREST's types are derived from
   * the literal type of this argument, and `'a, b' + 'c'` widens to `string`,
   * which collapses the whole result to an error type. `result` is deliberately
   * absent: it is the largest column by far and this page never reads it.
   */
  const { data, error } = await supabase
    .from('reconciliations')
    .select(
      'id, ledger_a_name, ledger_b_name, reconciliation_date, starting_ledger, tolerance_days, status, variance, starting_balance, closing_balance, matched_count, timing_count, one_sided_count, amount_diff_count, created_at',
    )
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows: Row[] = data ?? [];

  /*
   * With nothing to list there is nothing for a page header and a list to frame,
   * so the empty and the switched-off states are a hero of their own: the open
   * ledger in the arch, one sentence saying why the page is empty, and the way to
   * fill it. Once there is a history, the page goes back to being a list with a
   * summary over it, because then the list is the point.
   */
  if (error || rows.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        {/*
          The likeliest reason for an error here by a distance is that migration
          0008 has not been applied to this project. Saying so is more use than a
          generic failure, because it is a thing somebody can go and fix, and the
          tool itself works perfectly well without it.
        */}
        <ToolHero
          id="recon-history"
          label="Ledger Reconciliation · History"
          pill={
            error
              ? { icon: Database, text: 'Not switched on', tone: 'var(--status-warn)' }
              : { icon: Lock, text: 'Only you can see it', tone: 'var(--status-approved)' }
          }
          title={error ? 'History is not switched on yet.' : 'Nothing kept yet.'}
          sub={
            error
              ? 'The table that keeps saved reconciliations has not been created in this project. Apply migration 0008 and they will start appearing here. Reconciling and exporting work either way.'
              : 'Every reconciliation you run is kept here on its own, with the statement exactly as it came out on the day. Run one and it appears.'
          }
          scene={<ArchScene motif="ledger" className="h-full max-h-[24rem] min-h-[17rem]" />}
        >
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Link
              href="/reconcile"
              className={buttonClass({ variant: 'primary', className: 'group' })}
            >
              <Scale className="size-4 transition-transform group-hover:-rotate-6" aria-hidden />
              Reconcile two ledgers
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            <HeroChip icon={History}>Kept automatically, newest first</HeroChip>
            <HeroChip icon={ShieldCheck}>Yours only, enforced by the database</HeroChip>
          </div>
        </ToolHero>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Ledger Reconciliation"
        title="History"
        description="Every reconciliation you have run, with the statement kept as it was on the day."
        action={
          <Link href="/reconcile" className={buttonClass({ variant: 'primary' })}>
            <Plus className="size-4" aria-hidden />
            New reconciliation
          </Link>
        }
      />

      <HistorySummary
        runs={rows.map((row) => ({
          status: row.status,
          matched: row.matched_count,
          differences: row.timing_count + row.one_sided_count + row.amount_diff_count,
        }))}
      />

      <ul className="stagger space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <HistoryRow
              id={row.id}
              ledgerA={row.ledger_a_name}
              ledgerB={row.ledger_b_name}
              asAt={formatLedgerDate(row.reconciliation_date)}
              status={row.status}
              variance={row.variance}
              varianceLabel={
                Math.abs(row.variance) < 0.01 ? 'Nil' : formatINR(Math.abs(row.variance))
              }
              closing={formatINR(row.closing_balance)}
              toleranceDays={row.tolerance_days}
              counts={{
                matched: row.matched_count,
                timing: row.timing_count,
                oneSided: row.one_sided_count,
                amountDiff: row.amount_diff_count,
              }}
              ranAt={new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(row.created_at))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

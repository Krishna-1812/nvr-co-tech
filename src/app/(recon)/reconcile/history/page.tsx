import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, History, Plus, Scale } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, EmptyState, buttonClass } from '@/components/ui/primitives';
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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

      {/*
        The likeliest reason for an error here by a distance is that migration
        0008 has not been applied to this project. Saying so is more use than a
        generic failure, because it is a thing somebody can go and fix, and the
        tool itself works perfectly well without it.
      */}
      {error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Database className="size-6" />}
              title="History is not switched on yet"
              description="The table that keeps saved reconciliations has not been created in this project. Apply migration 0008 and they will start appearing here. Reconciling and exporting work either way."
              action={
                <Link href="/reconcile" className={buttonClass({ variant: 'primary' })}>
                  <Scale className="size-4" aria-hidden />
                  Reconcile something
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<History className="size-6" />}
              title="Nothing here yet"
              description="Reconciliations are kept automatically once you run one. Only you can see them."
              action={
                <Link href="/reconcile" className={buttonClass({ variant: 'primary' })}>
                  <Scale className="size-4" aria-hidden />
                  Reconcile two ledgers
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="stagger space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <HistoryRow
                id={row.id}
                title={`${row.ledger_a_name} against ${row.ledger_b_name}`}
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
      )}
    </div>
  );
}

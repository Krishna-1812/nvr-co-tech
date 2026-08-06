import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { ReconResult } from '@/lib/recon/types';
import { PageHeader } from '@/components/PageHeader';
import { ResultView } from '@/components/recon/ResultView';
import { buttonClass } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Saved reconciliation' };

/**
 * A reconciliation, reopened.
 *
 * The same screen the run itself produced, from the stored result rather than
 * from a fresh computation. That is the point of keeping the whole statement
 * rather than a summary of it: a reconciliation looked at in eighteen months
 * shows exactly what it showed on the day, including the lines that matched,
 * even though the two files behind it have long since been superseded.
 *
 * Saving is off here, for the obvious reason.
 */
export default async function SavedReconciliationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  // No `created_by` filter: the read policy in 0008 already scopes this to your
  // own rows, so somebody else's id simply returns nothing and lands on 404.
  const { data } = await supabase
    .from('reconciliations')
    .select('id, result, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!data?.result) notFound();

  const result = data.result as ReconResult;
  const ranAt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(data.created_at));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow={`Run ${ranAt}`}
        title={`${result.summaryA.name} against ${result.summaryB.name}`}
        description={`Reconciled as at ${formatLedgerDate(result.statement.reconciliationDate)}. Kept exactly as it came out.`}
        action={
          <Link href="/reconcile/history" className={buttonClass()}>
            <ArrowLeft className="size-4" aria-hidden />
            All reconciliations
          </Link>
        }
      />

      <ResultView result={result} autoSave={false} />
    </div>
  );
}

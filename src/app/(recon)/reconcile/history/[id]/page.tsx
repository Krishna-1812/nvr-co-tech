import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, History } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { ReconResult } from '@/lib/recon/types';
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
 *
 * No page header above it: the result opens with its own hero, and a header
 * saying "Company books against Bank statement" over a hero saying the same thing
 * was the page saying it twice. What the header did carry that the hero does
 * not — when this was run — goes on the hero's label instead.
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
    <div className="mx-auto max-w-6xl space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/reconcile/history"
          className={buttonClass({ variant: 'ghost', size: 'sm', className: 'group -ml-2' })}
        >
          <ArrowLeft
            className="size-4 transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          All reconciliations
        </Link>
        <p className="text-subtle inline-flex items-center gap-1.5 text-xs">
          <History className="size-3.5" aria-hidden />
          Kept exactly as it came out
        </p>
      </nav>

      <ResultView
        result={result}
        autoSave={false}
        label={`Run ${ranAt} · as at ${formatLedgerDate(result.statement.reconciliationDate)}`}
      />
    </div>
  );
}

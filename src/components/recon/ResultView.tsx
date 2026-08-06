'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Cloud, CloudOff, Download, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/primitives';
import { saveReconciliation } from '@/app/actions/reconciliation';
import type { ReconResult } from '@/lib/recon/types';
import { DifferenceTable } from './DifferenceTable';
import { LedgerCards } from './LedgerCards';
import { Outcome } from './Outcome';
import { Statement } from './Statement';

/**
 * The answer, in the order somebody reads it.
 *
 * Outcome first, because that is the question. Then each book on its own, so the
 * two balances being reconciled can be checked before anything is concluded from
 * them. Then the statement, which is the working. Then every line, which is the
 * evidence. Anyone who stops after the first panel has the answer; anyone who
 * has to defend it can keep going.
 */
export function ResultView({
  result,
  onBack,
  onReset,
  /** Off when reopening something already in history: it is saved by definition. */
  autoSave = true,
}: {
  result: ReconResult;
  /** Absent when there is no live session to go back to. */
  onBack?: () => void;
  onReset?: () => void;
  autoSave?: boolean;
}) {
  const saved = useSaveOnce(result, autoSave);

  return (
    <div className="space-y-6">
      <Outcome result={result} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SavedState state={saved} />
        <ExportButtons result={result} />
      </div>

      <LedgerCards a={result.summaryA} b={result.summaryB} />
      <Statement statement={result.statement} />
      <DifferenceTable result={result} />

      {(onBack || onReset) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {onBack ? (
            <Button variant="secondary" onClick={onBack}>
              <ArrowLeft className="size-4" aria-hidden />
              Change the date or the starting book
            </Button>
          ) : (
            <span />
          )}
          {onReset && (
            <Button variant="ghost" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden />
              Start again with new files
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Saving ──────────────────────────────────────────────────────────────────

type SaveState =
  | { kind: 'off' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'failed'; error: string };

/**
 * Keep it, once.
 *
 * Saving happens on its own rather than behind a button, because the value of
 * the history is that it is complete, and a record you had to remember to keep
 * is a record with holes in it. It is deliberately not blocking: the statement
 * is already on screen and correct whether or not the save lands, so a failure
 * is reported as a line of text rather than as an interruption.
 *
 * The ref is what makes it once. React runs effects twice in development —
 * mount, clean up, mount again — and without the guard the same reconciliation
 * would be written to the history twice.
 *
 * There is deliberately NO cleanup cancelling the in-flight request. The two
 * together are a trap: the first pass starts the save and is then cancelled by
 * its own cleanup, and the second pass is skipped by the ref, so the promise
 * resolves into a closure that has been told to ignore it and the panel says
 * "Saving…" for ever. Since this runs at most once for the life of the
 * component, there is nothing a cleanup could usefully cancel; a setState after
 * unmount has been a no-op since React 18.
 */
function useSaveOnce(result: ReconResult, enabled: boolean): SaveState {
  const [state, setState] = useState<SaveState>(enabled ? { kind: 'saving' } : { kind: 'off' });
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;

    saveReconciliation(result).then((outcome) => {
      setState(outcome.ok ? { kind: 'saved' } : { kind: 'failed', error: outcome.error });
    });
  }, [enabled, result]);

  return state;
}

function SavedState({ state }: { state: SaveState }) {
  if (state.kind === 'off') return <span />;

  if (state.kind === 'saving') {
    return (
      <p className="text-subtle flex items-center gap-2 text-xs">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving to your history…
      </p>
    );
  }

  if (state.kind === 'saved') {
    return (
      <p className="text-subtle flex items-center gap-2 text-xs">
        <Cloud className="size-3.5" aria-hidden />
        Saved to your history. Only you can see it.
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
      <CloudOff className="mt-px size-3.5 shrink-0" aria-hidden />
      {state.error}
    </p>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────

function ExportButtons({ result }: { result: ReconResult }) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);

  const download = async (format: 'pdf' | 'xlsx') => {
    setBusy(format);
    try {
      /*
       * The result is posted rather than fetched by id. The whole thing was
       * computed in this browser from two files the server has never seen, so
       * there is nothing on the server to render from unless we send it — which
       * also means exporting works whether or not the save above succeeded.
       */
      const response = await fetch('/reconcile/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, result }),
      });
      if (!response.ok) throw new Error(await response.text());

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reconciliation-${result.statement.reconciliationDate}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Could not build the ${format === 'pdf' ? 'PDF' : 'workbook'}.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" onClick={() => download('pdf')} loading={busy === 'pdf'}>
        {busy !== 'pdf' && <Download className="size-4" aria-hidden />}
        PDF
      </Button>
      <Button onClick={() => download('xlsx')} loading={busy === 'xlsx'}>
        {busy !== 'xlsx' && <Download className="size-4" aria-hidden />}
        Excel
      </Button>
      <span className="text-subtle hidden items-center gap-1.5 text-xs sm:flex">
        <Check className="size-3.5" aria-hidden />
        Statement, both ledgers and every line
      </span>
    </div>
  );
}

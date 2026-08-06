'use client';

import { useCallback, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ledgerMaxDate, ledgerMinDate } from '@/lib/recon/calculator';
import { openLedger, remapLedger, type OpenedLedger } from '@/lib/recon/parse';
import type { Field as ColumnField } from '@/lib/recon/parse/columns';
import { reconcile } from '@/lib/recon/reconciler';
import { sampleFiles } from '@/lib/recon/samples';
import type { Ledger, LedgerKey, ReconResult, ValidationResult } from '@/lib/recon/types';
import { validate } from '@/lib/recon/validator';
import { ColumnStep, assignRole, type ColumnPanel } from './ColumnStep';
import { ConfigureStep } from './ConfigureStep';
import { Issues } from './Issues';
import { ResultView } from './ResultView';
import { Steps, type StepId } from './Steps';
import { UploadStep } from './UploadStep';

/**
 * The whole reconciliation, in one client component.
 *
 * Everything here runs in the browser: the files are read here, the columns are
 * resolved here, and the engine runs here. There is no session on a server and
 * nothing is uploaded, which is the property worth protecting — these are client
 * bank statements, and the honest answer to "where does our data go" should be
 * "nowhere". The only thing that ever leaves is the finished statement, and only
 * when it is saved or exported.
 *
 * It holds one piece of state per ledger and derives the rest. In particular the
 * parsed ledgers are recomputed from the raw rows whenever the column mapping
 * changes, rather than being patched — reading the file again under a new
 * mapping is cheap, and a half-remapped ledger is a bug that would be very hard
 * to see.
 */

type Slot = {
  file: File | null;
  opened: OpenedLedger | null;
  busy: boolean;
  error: string | null;
  /** What the statement will call this book. Editable on the columns step. */
  name: string;
  mapping: Record<ColumnField, number | null>;
};

const EMPTY: Slot = { file: null, opened: null, busy: false, error: null, name: '', mapping: {} as Record<ColumnField, number | null> };

/** "sample-bank-statement.csv" → "Sample bank statement". */
function nameFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (!stem) return '';
  return (stem.charAt(0).toUpperCase() + stem.slice(1)).slice(0, 60);
}

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'That file could not be read.';
}

export function Workbench() {
  const [step, setStep] = useState<StepId>('upload');
  const [slots, setSlots] = useState<Record<LedgerKey, Slot>>({ A: EMPTY, B: EMPTY });

  // Set when the columns step is confirmed, and the input to everything after it.
  const [ledgers, setLedgers] = useState<Record<LedgerKey, Ledger> | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [columnError, setColumnError] = useState<string | null>(null);

  const [startingLedger, setStartingLedger] = useState<LedgerKey>('A');
  const [date, setDate] = useState('');
  const [toleranceDays, setToleranceDays] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [result, setResult] = useState<ReconResult | null>(null);

  const patch = useCallback((key: LedgerKey, changes: Partial<Slot>) => {
    setSlots((current) => ({ ...current, [key]: { ...current[key], ...changes } }));
  }, []);

  /** Read one file and take its columns as the starting guess. */
  const acceptFile = useCallback(
    async (key: LedgerKey, file: File) => {
      patch(key, { file, busy: true, error: null, opened: null });
      try {
        const opened = await openLedger(file, nameFromFilename(file.name) || `Ledger ${key}`);
        patch(key, {
          busy: false,
          opened,
          name: nameFromFilename(file.name) || `Ledger ${key}`,
          mapping: { ...opened.columns.autoMapping },
        });
      } catch (error) {
        patch(key, { busy: false, opened: null, error: messageFrom(error) });
      }
    },
    [patch],
  );

  const clearFile = useCallback((key: LedgerKey) => setSlots((c) => ({ ...c, [key]: EMPTY })), []);

  const loadSamples = useCallback(async () => {
    const [a, b] = sampleFiles();
    await Promise.all([acceptFile('A', a), acceptFile('B', b)]);
  }, [acceptFile]);

  /*
   * Confirming the columns: re-read both files under the chosen mapping, then
   * work out what can be reconciled and when. Re-reading rather than adjusting
   * the already-parsed ledger is the point — the mapping decides how every row
   * is interpreted, not just which columns are shown.
   */
  const confirmColumns = useCallback(() => {
    const a = slots.A.opened;
    const b = slots.B.opened;
    if (!a || !b) return;

    try {
      const parsed: Record<LedgerKey, Ledger> = {
        A: remapLedger(a, slots.A.mapping, slots.A.name.trim() || 'Ledger A'),
        B: remapLedger(b, slots.B.mapping, slots.B.name.trim() || 'Ledger B'),
      };
      setLedgers(parsed);
      setValidation(validate(parsed.A, parsed.B));

      // The latest date either book knows about. Reconciling to anything earlier
      // is a choice; this is the default because it is the whole period.
      const latest = [ledgerMaxDate(parsed.A), ledgerMaxDate(parsed.B)]
        .filter((d): d is string => d !== null)
        .sort()
        .at(-1);
      setDate(latest ?? new Date().toISOString().slice(0, 10));

      setColumnError(null);
      setStep('configure');
    } catch (error) {
      setColumnError(messageFrom(error));
    }
  }, [slots]);

  const run = useCallback(() => {
    if (!ledgers || !date) return;
    setRunning(true);
    setRunError(null);
    try {
      setResult(reconcile(ledgers.A, ledgers.B, { reconciliationDate: date, startingLedger, toleranceDays }));
      setStep('result');
    } catch (error) {
      setRunError(messageFrom(error));
    } finally {
      setRunning(false);
    }
  }, [ledgers, date, startingLedger, toleranceDays]);

  const reset = useCallback(() => {
    setSlots({ A: EMPTY, B: EMPTY });
    setLedgers(null);
    setValidation(null);
    setResult(null);
    setDate('');
    setToleranceDays(null);
    setStartingLedger('A');
    setRunError(null);
    setColumnError(null);
    setStep('upload');
  }, []);

  const bothOpen = Boolean(slots.A.opened && slots.B.opened);

  const dates = useMemo(() => {
    if (!ledgers) return { auto: null, min: null, max: null };
    const mins = [ledgerMinDate(ledgers.A), ledgerMinDate(ledgers.B)].filter(
      (d): d is string => d !== null,
    );
    const maxes = [ledgerMaxDate(ledgers.A), ledgerMaxDate(ledgers.B)].filter(
      (d): d is string => d !== null,
    );
    return {
      auto: maxes.sort().at(-1) ?? null,
      min: mins.sort().at(0) ?? null,
      // Not capped at the latest transaction: reconciling as at a month end that
      // falls after the last line in either file is an ordinary thing to want.
      max: null,
    };
  }, [ledgers]);

  const panels: ColumnPanel[] = (['A', 'B'] as const)
    .filter((key) => slots[key].opened)
    .map((key) => ({
      key,
      name: slots[key].name,
      headers: slots[key].opened!.columns.headers,
      headerDetected: slots[key].opened!.columns.headerDetected,
      mapping: slots[key].mapping,
    }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Ledger Reconciliation"
        title={
          step === 'result' && result
            ? `${result.summaryA.name} against ${result.summaryB.name}`
            : 'Reconcile two ledgers'
        }
        description={
          step === 'result'
            ? undefined
            : 'Your books against a bank statement, or two sides of the same intercompany account. Everything is read in this browser.'
        }
      />

      <Steps
        current={step}
        onGo={(target) => {
          // Only backwards, and only to a step whose input still exists.
          if (target === 'upload') setStep('upload');
          else if (target === 'columns' && bothOpen) setStep('columns');
          else if (target === 'configure' && ledgers) setStep('configure');
        }}
      />

      {/* The file problems, shown from the moment they are known and kept on
          screen through the steps where they can still be acted on. */}
      {validation && step !== 'result' && <Issues issues={validation.issues} />}

      {step === 'upload' && (
        <UploadStep
          slots={(['A', 'B'] as const).map((key) => ({
            key,
            label: key === 'A' ? 'First ledger' : 'Second ledger',
            hint: key === 'A' ? 'Usually your own books' : 'Usually the bank statement',
            file: slots[key].file,
            busy: slots[key].busy,
            error: slots[key].error,
          }))}
          onFile={acceptFile}
          onClear={clearFile}
          onSample={loadSamples}
          canContinue={bothOpen}
          onContinue={() => setStep('columns')}
        />
      )}

      {step === 'columns' && bothOpen && (
        <ColumnStep
          panels={panels}
          error={columnError}
          onRole={(key, column, field) =>
            patch(key, { mapping: assignRole(slots[key].mapping, column, field) })
          }
          onName={(key, name) => patch(key, { name })}
          onBack={() => setStep('upload')}
          onContinue={confirmColumns}
        />
      )}

      {step === 'configure' && ledgers && (
        <ConfigureStep
          ledgerA={ledgers.A}
          ledgerB={ledgers.B}
          startingLedger={startingLedger}
          onStartingLedger={setStartingLedger}
          date={date}
          autoDate={dates.auto}
          minDate={dates.min}
          maxDate={dates.max}
          onDate={setDate}
          toleranceDays={toleranceDays}
          onToleranceDays={setToleranceDays}
          onBack={() => setStep('columns')}
          onRun={run}
          busy={running}
          blocked={validation ? !validation.isValid : false}
          error={runError}
        />
      )}

      {step === 'result' && result && (
        <ResultView result={result} onBack={() => setStep('configure')} onReset={reset} />
      )}
    </div>
  );
}

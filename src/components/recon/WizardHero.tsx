'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  FileSpreadsheet,
  FlaskConical,
  HardDrive,
  History,
  Lock,
} from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/primitives';
import { HeroChip, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene } from '@/components/ui/Scene';
import { MAX_FILE_MB } from '@/lib/recon/config';
import { formatLedgerDate } from '@/lib/recon/dates';
import { STEPS, type StepId } from './Steps';

/**
 * How the tool opens, and stays open, until there is an answer.
 *
 * There is no figure to lead with before the run — nothing has been compared
 * yet — so the hero leads with the task instead, in a sentence that changes as
 * the task does: reconcile two ledgers, then check the columns, then choose the
 * date. Keeping the same frame through all three steps is deliberate. The page
 * does not jump about between steps, the step rail sits in the same place, and
 * the result arriving in that frame as a figure reads as the answer to the
 * question the frame has been asking all along.
 *
 * The scales have no seal here. A seal carries one real figure, and until the
 * engine has run there is not one worth putting on it.
 */

const COPY: Record<Exclude<StepId, 'result'>, { title: string; sub: string }> = {
  upload: {
    title: 'Reconcile two ledgers.',
    sub: 'Your books against a bank statement, or two sides of the same intercompany account. Drop both in, and every difference between them comes back explained.',
  },
  columns: {
    title: 'Check what each column is.',
    sub: 'Both files were read and each column given a guess from its header. Confirm the guess, correct anything wrong, and name each book the way the statement should.',
  },
  configure: {
    title: 'Choose where to start, and when.',
    sub: 'The statement walks from one book’s balance to the other’s, as at the date you choose. Each choice below shows the balance it starts from.',
  },
};

export function WizardHero({
  step,
  steps,
  onSample,
  files,
  span,
}: {
  step: Exclude<StepId, 'result'>;
  /** The step rail, set at the foot of the hero. */
  steps: ReactNode;
  onSample: () => void;
  /** The two files, once read: their names and how many lines each gave. */
  files: { name: string; lines: number }[];
  /** The earliest and latest dates either file holds, once the columns are set. */
  span: { from: string | null; to: string | null };
}) {
  const copy = COPY[step];
  const number = STEPS.findIndex((s) => s.id === step) + 1;

  return (
    <ToolHero
      id="recon-hero"
      label={`Ledger Reconciliation · Step ${number} of ${STEPS.length}`}
      pill={{ icon: Lock, text: 'Never leaves this browser', tone: 'var(--status-approved)' }}
      title={copy.title}
      sub={copy.sub}
      scene={<ArchScene motif="scales" className="h-full max-h-[26rem] min-h-[18rem]" />}
    >
      {step === 'upload' ? (
        <>
          {/* The sample pair is the answer to "what does this do?", which comes
              before anybody has a file in hand. Its description is what the
              pair in lib/recon/samples is built to show. */}
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button onClick={onSample} className="group">
              <FlaskConical
                className="size-4 transition-transform group-hover:-rotate-12"
                aria-hidden
              />
              Try the samples
            </Button>
            <Link href="/reconcile/history" className={buttonClass({ variant: 'ghost' })}>
              <History className="size-4" aria-hidden />
              Your history
            </Link>
          </div>
          <p className="text-subtle mt-3 max-w-xl text-[12.5px] leading-relaxed text-pretty">
            The samples are a company’s books and its bank statement for April 2026, written from
            opposite sides, with two differences to explain.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <HeroChip icon={FileSpreadsheet}>Excel, CSV or a text PDF</HeroChip>
            <HeroChip icon={HardDrive}>Up to {MAX_FILE_MB} MB each</HeroChip>
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {files.map((file, i) => (
            <HeroChip key={i} icon={FileSpreadsheet}>
              <span className="max-w-[16rem] truncate">{file.name}</span>
              <span className="text-subtle tabular-nums">
                · {file.lines.toLocaleString('en-IN')} {file.lines === 1 ? 'line' : 'lines'}
              </span>
            </HeroChip>
          ))}
          {step === 'configure' && span.from && span.to && (
            <HeroChip icon={CalendarRange}>
              Entries from {formatLedgerDate(span.from)} to {formatLedgerDate(span.to)}
            </HeroChip>
          )}
        </div>
      )}

      <div className="mt-8">{steps}</div>
    </ToolHero>
  );
}

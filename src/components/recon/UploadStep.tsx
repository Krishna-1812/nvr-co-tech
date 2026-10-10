'use client';

import { ArrowRight, FolderUp, Info, Scale } from 'lucide-react';
import { Button, Card, CardBody, CardTitle } from '@/components/ui/primitives';
import { MAX_FILE_MB } from '@/lib/recon/config';
import { DropZone } from './DropZone';
import { LEDGER_TONE } from './tone';

/**
 * Step one: the two files.
 *
 * Both at once rather than one after the other, because a reconciliation is a
 * comparison and the shape of the task is two things side by side. Uploading one
 * and being asked for another reads as a form; two panels reads as what it is.
 * The balance between them says the same thing without a word: these two are
 * about to be weighed against each other.
 *
 * The sample pair lives in the hero above, beside the headline, because it is
 * the answer to the first question most people arrive with — "what does this
 * do?" — and that question comes before anybody has a file in hand.
 */
export function UploadStep({
  slots,
  onFile,
  onClear,
  onContinue,
  canContinue,
}: {
  slots: {
    key: 'A' | 'B';
    label: string;
    hint: string;
    file: File | null;
    /** Lines read from the file, once it has been read. */
    lines: number | null;
    busy: boolean;
    error: string | null;
  }[];
  onFile: (key: 'A' | 'B', file: File) => void;
  onClear: (key: 'A' | 'B') => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const ready = slots.filter((s) => s.lines !== null && !s.busy && !s.error).length;

  return (
    <Card>
      <CardTitle
        icon={<FolderUp className="size-4" />}
        title="The two ledgers"
        description="Each needs a date, a description, and debit and credit columns. The two rarely call them the same thing; the next step sorts that out."
      />

      <CardBody className="space-y-5 py-5 sm:py-6">
        <div className="relative grid gap-4 sm:grid-cols-2 sm:gap-5">
          {slots.map((slot) => (
            <DropZone
              key={slot.key}
              letter={slot.key}
              label={slot.label}
              hint={slot.hint}
              file={slot.file}
              lines={slot.lines}
              busy={slot.busy}
              error={slot.error}
              accent={LEDGER_TONE[slot.key]}
              onFile={(file) => onFile(slot.key, file)}
              onClear={() => onClear(slot.key)}
            />
          ))}

          {/* The fulcrum between the two. Decoration: the pairing is already
              said by the labels, First ledger and Second ledger. */}
          <span
            aria-hidden
            className="surface-lit elev-2 text-muted pointer-events-none absolute top-[7.5rem] left-1/2 hidden size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border sm:grid"
          >
            <Scale className="size-4.5" />
          </span>
        </div>

        {/*
          Said before anything goes wrong rather than in an error afterwards.
          The scanned-PDF limit in particular is the one people hit, and finding
          out after uploading a 40-page statement is the worst time to learn it.
        */}
        <p className="text-subtle flex items-start gap-2 text-xs leading-relaxed text-pretty">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            A PDF has to be a real one with text in it, not a scan or a photograph. Up to{' '}
            {MAX_FILE_MB} MB each, read in this browser and never uploaded anywhere.
          </span>
        </p>

        <div className="surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
          <p className="text-muted flex items-center gap-2.5 text-[13px]">
            <span className="flex gap-1" aria-hidden>
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full transition-colors"
                  style={{
                    background: i < ready ? 'var(--status-approved)' : 'var(--border-strong)',
                  }}
                />
              ))}
            </span>
            {ready === 2
              ? 'Both ledgers read. Next, check what each column is.'
              : ready === 1
                ? 'One ledger read. Choose the other to continue.'
                : 'Choose both files to continue.'}
          </p>
          <Button variant="primary" onClick={onContinue} disabled={!canContinue}>
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

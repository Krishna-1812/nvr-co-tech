'use client';

import { ArrowRight, FlaskConical, Info } from 'lucide-react';
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
 *
 * The sample pair is here for a real reason and not as a demo flourish. You
 * cannot see what this does until you have two files that belong together, and
 * most people arrive with one bank statement and nothing to compare it against.
 * Sending them away to find a second file is how a tool gets closed.
 */
export function UploadStep({
  slots,
  onFile,
  onClear,
  onSample,
  onContinue,
  canContinue,
}: {
  slots: {
    key: 'A' | 'B';
    label: string;
    hint: string;
    file: File | null;
    busy: boolean;
    error: string | null;
  }[];
  onFile: (key: 'A' | 'B', file: File) => void;
  onClear: (key: 'A' | 'B') => void;
  onSample: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <Card>
      <CardTitle
        icon={<ArrowRight className="size-4" />}
        title="The two ledgers"
        description="Excel, CSV or a text PDF. Each needs a date, a description, and debit and credit columns."
        action={
          <Button variant="ghost" size="sm" onClick={onSample}>
            <FlaskConical className="size-4" aria-hidden />
            Try the samples
          </Button>
        }
      />

      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {slots.map((slot) => (
            <DropZone
              key={slot.key}
              label={slot.label}
              hint={slot.hint}
              file={slot.file}
              busy={slot.busy}
              error={slot.error}
              accent={LEDGER_TONE[slot.key]}
              onFile={(file) => onFile(slot.key, file)}
              onClear={() => onClear(slot.key)}
            />
          ))}
        </div>

        {/*
          Said before anything goes wrong rather than in an error afterwards.
          The scanned-PDF limit in particular is the one people hit, and finding
          out after uploading a 40-page statement is the worst time to learn it.
        */}
        <p className="text-subtle flex items-start gap-2 text-xs leading-relaxed text-pretty">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Up to {MAX_FILE_MB} MB each. A PDF has to be a real one with text in it, not a scan or
            a photograph. Nothing is uploaded anywhere: the files are read in this browser and
            never leave your machine.
          </span>
        </p>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onContinue} disabled={!canContinue}>
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

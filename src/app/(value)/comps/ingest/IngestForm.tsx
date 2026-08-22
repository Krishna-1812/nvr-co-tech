'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UploadCloud } from 'lucide-react';
import { runValuationIngest, runValuationMcaBatch } from '@/app/actions/valuationIngest';
import { batch, MCA_BATCH_SIZE, sheetRowsToRecords } from '@/lib/comps/ingest/sheetRows';
import { tallySkips } from '@/lib/comps/sources/mcaMaster';
import type { Skip } from '@/lib/comps/sources/types';
import { readCsv, readWorkbook, type RawSheet } from '@/lib/recon/parse/sheet';
import { Button, Card, CardTitle, Input, Select, Textarea } from '@/components/ui/primitives';

type Source = 'edgar' | 'nse' | 'mca_master';

const SOURCE_META: Record<Source, { label: string; hint: string }> = {
  edgar: {
    label: 'SEC EDGAR (US filers, by CIK)',
    hint: 'Works from here — no session to negotiate, and it is what the pipeline has been proven against (Apple, Microsoft). Good for testing the pipeline itself.',
  },
  nse: {
    label: 'NSE (Indian listed companies, by symbol)',
    hint: 'This machine is a datacentre address and NSE challenges those, so this will very likely refuse every symbol from here. If it does, the skip line below will say so rather than fail silently — that is the confirmation this page exists to get.',
  },
  mca_master: {
    label: 'MCA company master data (India, by file)',
    hint: 'Free, official, and not blocked like NSE — but it is company identity only: name, CIN, status, state, NIC code. No revenue, no market cap. Download a CSV from data.gov.in and pick it below; nothing leaves your browser except the parsed rows, in small batches.',
  },
};

const IDENTIFIER_PLACEHOLDER: Record<'edgar' | 'nse', string> = {
  edgar: '320193, 789019',
  nse: 'RELIANCE, TCS, INFY',
};

/** Extension-aware read, sized for a company-master file rather than a bank statement. */
const MAX_MCA_FILE_MB = 300;

async function readMcaFile(file: File): Promise<RawSheet> {
  if (file.size === 0) throw new Error(`${file.name} is empty.`);
  if (file.size > MAX_MCA_FILE_MB * 1024 * 1024) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(0)} MB, over the ${MAX_MCA_FILE_MB} MB limit. ` +
        `data.gov.in publishes this per state — try one state at a time.`,
    );
  }

  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (extension === '.csv' || extension === '.txt') return readCsv(await file.text());
  if (extension === '.xlsx') return readWorkbook(await file.arrayBuffer());
  throw new Error(`${file.name} is not a format this reads. Use the .csv data.gov.in publishes, or .xlsx.`);
}

/** A tally, merged into a running total across every batch rather than held as full skip lists. */
function mergeTally(into: Map<string, number>, skips: readonly Skip[]) {
  for (const { reason, count } of tallySkips(skips)) into.set(reason, (into.get(reason) ?? 0) + count);
}

function tallyLines(tally: Map<string, number>, limit = 20): string[] {
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([reason, count]) => `  ${String(count).padStart(7)}  ${reason}`);
}

/**
 * Seeding the registry, from the operator's own session.
 *
 * A plain client form rather than a GET link like the comparables filter bar:
 * this triggers a write with real network calls to a rate-limited source, so it
 * is deliberately not something that fires again on every back-button press or
 * page refresh.
 *
 * MCA is a different shape from the other two on purpose. EDGAR and NSE are one
 * request, one response, one submit. MCA is a file the browser has already
 * downloaded and this parses itself — into what could be hundreds of thousands
 * of rows — so it goes out in `MCA_BATCH_SIZE`-row calls, one after another,
 * with a running total on screen rather than a single result at the end. See
 * `runValuationMcaBatch` for why each call is capped rather than the whole file
 * going in one request.
 */
export function IngestForm() {
  const router = useRouter();
  // No ref: `Input` is a plain function component, not forwardRef-wrapped, so
  // a ref on it never reaches the underlying <input>. A file input can't take
  // a controlled `value` either, so `inputKey` is what clears it after a run —
  // bumping it remounts a fresh, empty input rather than trying to reset one.
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [source, setSource] = useState<Source>('edgar');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ headline: string; skipped: string[] } | null>(null);

  const submitIdentifiers = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);

    const identifiers = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const res = await runValuationIngest({ source: source as 'edgar' | 'nse', identifiers });

    setBusy(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    setResult(res.data);
    toast.success(res.data.headline);
    // The comparables page reads the registry fresh; refresh this one too so a
    // second run shows in the picker's company list without a manual reload.
    router.refresh();
  };

  const submitMcaFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    setResult(null);
    setProgress(null);

    try {
      const sheet = await readMcaFile(file);
      const records = sheetRowsToRecords(sheet);
      if (records.length === 0) {
        toast.error(`No rows found under a header in ${file.name}.`);
        return;
      }

      const chunks = batch(records, MCA_BATCH_SIZE);
      let companiesWritten = 0;
      let rowsDone = 0;
      const tally = new Map<string, number>();

      for (const chunk of chunks) {
        const res = await runValuationMcaBatch({ rows: chunk, firstRowNumber: rowsDone + 1 });
        if (!res.ok) {
          toast.error(`Stopped at row ${rowsDone + 1}: ${res.error}`);
          break;
        }
        companiesWritten += res.data.companiesWritten;
        mergeTally(tally, res.data.skipped);
        rowsDone += chunk.length;
        setProgress({ done: rowsDone, total: records.length });
      }

      const skippedTotal = [...tally.values()].reduce((a, b) => a + b, 0);
      setResult({
        headline: `mca_master · ${rowsDone.toLocaleString('en-IN')} of ${records.length.toLocaleString('en-IN')} rows · ${companiesWritten.toLocaleString('en-IN')} companies · ${skippedTotal.toLocaleString('en-IN')} skipped`,
        skipped: tallyLines(tally),
      });
      toast.success(`${companiesWritten.toLocaleString('en-IN')} companies written from ${file.name}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not read ${file.name}.`);
    } finally {
      setBusy(false);
      setProgress(null);
      setFile(null);
      setInputKey((k) => k + 1);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<UploadCloud className="size-4" />}
        title="Seed the registry"
        description="Fetch real companies from a source and write them in. This is what makes the comparables screen have something to show."
      />
      <div className="space-y-3 px-5 py-4">
        <div className="w-full sm:w-96">
          <label htmlFor="ingest_source" className="text-subtle mb-1.5 block text-xs font-medium">
            Source
          </label>
          <Select id="ingest_source" value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {(Object.keys(SOURCE_META) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_META[s].label}
              </option>
            ))}
          </Select>
          <p className="text-subtle mt-1.5 text-xs leading-snug">{SOURCE_META[source].hint}</p>
        </div>

        {source === 'mca_master' ? (
          <form onSubmit={submitMcaFile} className="space-y-3">
            <div>
              <label htmlFor="ingest_file" className="text-subtle mb-1.5 block text-xs font-medium">
                Company master file (.csv or .xlsx)
              </label>
              <Input
                key={inputKey}
                id="ingest_file"
                type="file"
                accept=".csv,.txt,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" variant="primary" loading={busy} disabled={!file}>
              Run ingest
            </Button>
            {progress && (
              <p className="text-subtle text-xs tabular-nums">
                {progress.done.toLocaleString('en-IN')} of {progress.total.toLocaleString('en-IN')} rows written
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={submitIdentifiers} className="space-y-3">
            <div>
              <label htmlFor="ingest_identifiers" className="text-subtle mb-1.5 block text-xs font-medium">
                Identifiers, comma or line separated
              </label>
              <Textarea
                id="ingest_identifiers"
                rows={3}
                placeholder={IDENTIFIER_PLACEHOLDER[source]}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" loading={busy} disabled={!text.trim()}>
              Run ingest
            </Button>
          </form>
        )}
      </div>

      {result && (
        <div className="border-t px-5 py-4 text-sm">
          <p className="font-medium">{result.headline}</p>
          {result.skipped.length > 0 && (
            <ul className="text-subtle mt-2 space-y-1 font-mono text-xs">
              {result.skipped.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

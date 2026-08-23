'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UploadCloud } from 'lucide-react';
import {
  fetchEdgarUniverse,
  runValuationIngest,
  runValuationMcaBatch,
  runValuationMcaLiveBatch,
} from '@/app/actions/valuationIngest';
import { batch, MAX_ITEMS, MCA_BATCH_SIZE, sheetRowsToRecords } from '@/lib/comps/ingest/sheetRows';
import { KNOWN_STATES } from '@/lib/comps/sources/mcaLive';
import { tallySkips } from '@/lib/comps/sources/mcaMaster';
import type { Skip } from '@/lib/comps/sources/types';
import { readCsv, readWorkbook, type RawSheet } from '@/lib/recon/parse/sheet';
import { Button, Card, CardTitle, Input, Select, Textarea } from '@/components/ui/primitives';

type Source = 'edgar' | 'nse' | 'mca_master';

const SOURCE_META: Record<Source, { label: string; hint: string }> = {
  edgar: {
    label: 'SEC EDGAR (US filers, by CIK)',
    hint: 'Works from here — no session to negotiate, and it is what the pipeline has been proven against (Apple, Microsoft). Paste a few CIKs to test, or use "Sync every SEC company" below to pull the whole free universe — about 10,400 of them.',
  },
  nse: {
    label: 'NSE (Indian listed companies, by symbol)',
    hint: 'This machine is a datacentre address and NSE challenges those, so this will very likely refuse every symbol from here. If it does, the skip line below will say so rather than fail silently — that is the confirmation this page exists to get.',
  },
  mca_master: {
    label: 'MCA company master data (India)',
    hint: 'Free and official — but it is company identity only: name, CIN, status, state, NIC code. No revenue, no market cap. "Sync automatically" below pulls straight from data.gov.in with no file needed; the upload option stays for a fuller export from elsewhere.',
  },
};

/**
 * Resumability, kept deliberately low-tech: a restart is always safe because
 * `upsert_company` dedupes by identifier, so localStorage only needs to save
 * time, not correctness. If it is empty, wrong, or from a different browser,
 * the run just starts from the top — never a reason to fail.
 */
const EDGAR_UNIVERSE_KEY = 'valuationDesk.edgarUniverseSync';
const MCA_LIVE_KEY = 'valuationDesk.mcaLiveSync';

function readEdgarResume(): number {
  try {
    const raw = localStorage.getItem(EDGAR_UNIVERSE_KEY);
    const done = raw ? (JSON.parse(raw) as { done?: number }).done : undefined;
    return typeof done === 'number' && done > 0 ? done : 0;
  } catch {
    return 0;
  }
}

function readMcaLiveResume(): string[] {
  try {
    const raw = localStorage.getItem(MCA_LIVE_KEY);
    const done = raw ? (JSON.parse(raw) as { completedStates?: string[] }).completedStates : undefined;
    return Array.isArray(done) ? done.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function readMcaLiveResumeCount(): number {
  return readMcaLiveResume().length;
}

/**
 * No real event to subscribe to — a write from this same tab does not raise a
 * `storage` event, only a write from another tab would. Reading the resume
 * counters through `useSyncExternalStore` instead of a `useEffect` avoids a
 * server/client hydration mismatch (the server has no `localStorage` at all)
 * without needing a synchronous `setState` in an effect body to patch it after
 * mount; the counters pick up every write anyway because the sync loops below
 * already re-render the component on every chunk.
 */
function noExternalSubscription() {
  return () => {};
}

function serverSnapshotZero() {
  return 0;
}

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
 * Re-merges lines `skipLines()` already formatted as `  ###  reason` — the shape
 * `runValuationIngest` returns, with the per-chunk counts baked in rather than
 * raw `Skip[]`. A full-universe sync calls it hundreds of times, so this parses
 * each chunk's own already-correct counts back out rather than re-tallying by
 * line (which would count each formatted string as one, discarding the number
 * printed inside it).
 */
function mergeFormattedTally(into: Map<string, number>, lines: readonly string[]) {
  for (const line of lines) {
    const match = /^\s*(\d+)\s{2}(.*)$/.exec(line);
    if (!match) continue;
    const [, countText, reason] = match;
    into.set(reason, (into.get(reason) ?? 0) + Number(countText));
  }
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

  const edgarResume = useSyncExternalStore(noExternalSubscription, readEdgarResume, serverSnapshotZero);
  const [edgarSyncing, setEdgarSyncing] = useState(false);
  const [edgarSyncProgress, setEdgarSyncProgress] = useState<{ done: number; total: number } | null>(null);

  const mcaResumeCount = useSyncExternalStore(noExternalSubscription, readMcaLiveResumeCount, serverSnapshotZero);
  const [mcaSyncing, setMcaSyncing] = useState(false);
  const [mcaSyncProgress, setMcaSyncProgress] = useState<{
    stateIndex: number;
    stateName: string;
    rowsDone: number;
    reachable: number;
  } | null>(null);

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

  /**
   * Every SEC-registered ticker, fetched once and then driven through the exact
   * same `runValuationIngest` the manual textbox above already calls — chunked
   * to `MAX_ITEMS` so no single request runs long enough to time out.
   *
   * Genuinely a full sync, not a best-effort one: SEC's bulk ticker file is the
   * whole free universe, with no ceiling like MCA's below.
   */
  const syncEdgarUniverse = async (resumeFrom: number) => {
    setEdgarSyncing(true);
    setResult(null);

    try {
      const universeRes = await fetchEdgarUniverse();
      if (!universeRes.ok) {
        toast.error(universeRes.error);
        return;
      }

      const universe = universeRes.data;
      const remaining = universe.slice(resumeFrom).map((c) => c.cik);
      const chunks = batch(remaining, MAX_ITEMS);
      let done = resumeFrom;
      const tally = new Map<string, number>();

      for (const chunk of chunks) {
        // A chunk that throws (a dropped connection, a host-side timeout) is
        // exactly as much a stop as one that resolves with ok:false — both
        // leave `done` at the last successfully written company, which is
        // what's on screen and in localStorage for "Resume" to pick up from.
        let res;
        try {
          res = await runValuationIngest({ source: 'edgar', identifiers: chunk });
        } catch (error) {
          toast.error(
            `Stopped at company ${done + 1} of ${universe.length}: ${error instanceof Error ? error.message : 'the request failed.'} Resume picks up from here.`,
          );
          break;
        }
        if (!res.ok) {
          toast.error(`Stopped at company ${done + 1} of ${universe.length}: ${res.error}`);
          break;
        }
        mergeFormattedTally(tally, res.data.skipped);
        done += chunk.length;
        setEdgarSyncProgress({ done, total: universe.length });
        try {
          localStorage.setItem(EDGAR_UNIVERSE_KEY, JSON.stringify({ done }));
        } catch {
          // Best-effort only — a restart is always safe, just slower.
        }
      }

      if (done >= universe.length) {
        try {
          localStorage.removeItem(EDGAR_UNIVERSE_KEY);
        } catch {
          // Nothing to do if storage is unavailable; the stale entry is harmless.
        }
      }

      setResult({
        headline: `sec_edgar · ${done.toLocaleString('en-US')} of ${universe.length.toLocaleString('en-US')} companies attempted this session`,
        skipped: tallyLines(tally),
      });
      toast.success(`Reached ${done.toLocaleString('en-US')} of ${universe.length.toLocaleString('en-US')} SEC companies.`);
      router.refresh();
    } finally {
      // Always, even on a thrown error above — a stuck spinner with no way
      // back but a page reload is worse than an early stop the user can retry.
      setEdgarSyncing(false);
      setEdgarSyncProgress(null);
    }
  };

  /**
   * Every state this door can reach, in one pass — full for the small ones,
   * capped at 10,000 rows for the large ones. See `mcaLive.ts` for why the cap
   * exists and cannot be raised by asking differently.
   */
  const syncMcaLive = async () => {
    setMcaSyncing(true);
    setResult(null);

    const alreadyDone = new Set(readMcaLiveResume());
    let companiesWritten = 0;
    const tally = new Map<string, number>();

    try {
      for (let i = 0; i < KNOWN_STATES.length; i++) {
        const state = KNOWN_STATES[i];
        if (alreadyDone.has(state)) continue;

        let offset = 0;
        let reachable = MCA_BATCH_SIZE; // Corrected once the first page reports a real total.
        let stopped = false;

        while (offset < reachable) {
          // Same reasoning as the EDGAR loop above: a thrown error (a dropped
          // connection, a host-side timeout) has to stop the loop and surface,
          // not hang the button forever — see the `finally` below.
          let res;
          try {
            res = await runValuationMcaLiveBatch({ state, offset });
          } catch (error) {
            toast.error(
              `Stopped at ${state}, row ${offset + 1}: ${error instanceof Error ? error.message : 'the request failed.'}`,
            );
            stopped = true;
            break;
          }
          if (!res.ok) {
            toast.error(`Stopped at ${state}, row ${offset + 1}: ${res.error}`);
            stopped = true;
            break;
          }
          companiesWritten += res.data.companiesWritten;
          mergeTally(tally, res.data.skipped);
          reachable = res.data.reachable;
          offset += MCA_BATCH_SIZE;
          setMcaSyncProgress({ stateIndex: i, stateName: state, rowsDone: Math.min(offset, reachable), reachable });
        }

        if (stopped) break;

        alreadyDone.add(state);
        try {
          localStorage.setItem(MCA_LIVE_KEY, JSON.stringify({ completedStates: [...alreadyDone] }));
        } catch {
          // Best-effort only — a restart just re-runs completed states, which is safe.
        }
      }

      if (alreadyDone.size >= KNOWN_STATES.length) {
        try {
          localStorage.removeItem(MCA_LIVE_KEY);
        } catch {
          // Harmless if it lingers.
        }
      }

      const skippedTotal = [...tally.values()].reduce((a, b) => a + b, 0);
      setResult({
        headline: `mca_master (live) · ${alreadyDone.size} of ${KNOWN_STATES.length} states · ${companiesWritten.toLocaleString('en-IN')} companies · ${skippedTotal.toLocaleString('en-IN')} skipped`,
        skipped: tallyLines(tally),
      });
      toast.success(`${companiesWritten.toLocaleString('en-IN')} companies written from the live MCA sync.`);
      router.refresh();
    } finally {
      setMcaSyncing(false);
      setMcaSyncProgress(null);
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
          <div className="space-y-4">
            <div className="border-subtle rounded-md border p-3">
              <p className="text-sm font-medium">Sync automatically from data.gov.in</p>
              <p className="text-subtle mt-1 text-xs leading-snug">
                Pulls every state this API can reach, no file needed — complete for 10 small states/UTs
                (~16,000 companies), capped at the first 10,000 rows for the ~25 larger ones. That cap is
                data.gov.in&apos;s own search index, not this tool — the government platform refuses any
                request asking for more than 10,000 rows of a filtered result, and no combination of its
                filters gets a state like Maharashtra (821,545 companies) under that. Real completeness for a
                large state needs a paid MCA21 export or a licensed vendor; this gets everything free access
                can reach. Takes roughly 20&ndash;40 minutes — keep this tab open.
              </p>
              {mcaResumeCount > 0 && !mcaSyncing && (
                <p className="text-subtle mt-2 text-xs">
                  {mcaResumeCount} of {KNOWN_STATES.length} states already done from a previous run — starting
                  again will pick up where it left off.
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                className="mt-3"
                loading={mcaSyncing}
                disabled={mcaSyncing || busy}
                onClick={() => void syncMcaLive()}
              >
                {mcaResumeCount > 0 ? 'Resume automatic sync' : 'Sync automatically'}
              </Button>
              {mcaSyncProgress && (
                <p className="text-subtle mt-2 text-xs tabular-nums">
                  State {mcaSyncProgress.stateIndex + 1} of {KNOWN_STATES.length} ({mcaSyncProgress.stateName}) ·{' '}
                  {mcaSyncProgress.rowsDone.toLocaleString('en-IN')} of{' '}
                  {mcaSyncProgress.reachable.toLocaleString('en-IN')} reachable rows
                </p>
              )}
            </div>

            <div className="border-subtle border-t pt-4">
              <p className="text-subtle mb-2 text-xs font-medium">Or upload a fuller export from elsewhere</p>
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
                <Button type="submit" variant="secondary" loading={busy} disabled={!file || mcaSyncing}>
                  Run ingest
                </Button>
                {progress && (
                  <p className="text-subtle text-xs tabular-nums">
                    {progress.done.toLocaleString('en-IN')} of {progress.total.toLocaleString('en-IN')} rows written
                  </p>
                )}
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
              <Button type="submit" variant="primary" loading={busy} disabled={!text.trim() || edgarSyncing}>
                Run ingest
              </Button>
            </form>

            {source === 'edgar' && (
              <div className="border-subtle border-t pt-4">
                <p className="text-sm font-medium">Sync every SEC-registered company</p>
                <p className="text-subtle mt-1 text-xs leading-snug">
                  Pulls SEC&apos;s own free, keyless list of every registered ticker (~10,400 — Nasdaq, NYSE,
                  OTC and CBOE) and runs each one through this exact pipeline. Genuinely the whole universe,
                  not a partial slice. Takes roughly an hour at EDGAR&apos;s own rate limit — keep this tab
                  open; closing it is safe, re-running just skips ahead to where it left off.
                </p>
                {edgarResume > 0 && !edgarSyncing && (
                  <p className="text-subtle mt-2 text-xs">
                    {edgarResume.toLocaleString('en-US')} companies already attempted — resuming continues
                    from there.
                  </p>
                )}
                <Button
                  type="button"
                  variant="primary"
                  className="mt-3"
                  loading={edgarSyncing}
                  disabled={edgarSyncing || busy}
                  onClick={() => void syncEdgarUniverse(edgarResume)}
                >
                  {edgarResume > 0 ? 'Resume full sync' : 'Sync every SEC company'}
                </Button>
                {edgarSyncProgress && (
                  <p className="text-subtle mt-2 text-xs tabular-nums">
                    {edgarSyncProgress.done.toLocaleString('en-US')} of{' '}
                    {edgarSyncProgress.total.toLocaleString('en-US')} companies attempted
                  </p>
                )}
              </div>
            )}
          </div>
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

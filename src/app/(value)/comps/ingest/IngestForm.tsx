'use client';

import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2,
  CandlestickChart,
  Check,
  ClipboardCheck,
  Clock,
  Database,
  FileSpreadsheet,
  Globe,
  History,
  Landmark,
  ListPlus,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
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
import { Button, Card, CardTitle, Field, Input, Textarea } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

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

  const anyRunning = busy || edgarSyncing || mcaSyncing;

  return (
    <div className="space-y-6">
      {/* ── Where from ─────────────────────────────────────────────────── */}
      <Card className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden">
        <CardTitle
          icon={<Database className="size-4" />}
          title="Choose a source"
          description="Each one writes into the same shared registry. What it can reach from here differs, and the note under it says how."
        />
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div role="radiogroup" aria-label="Source" className="grid gap-3 md:grid-cols-3">
            {(Object.keys(SOURCE_META) as Source[]).map((s) => {
              const on = s === source;
              const Icon = SOURCE_FACE[s].icon;
              return (
                <label
                  key={s}
                  className={cn(
                    'group relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/25',
                    on
                      ? 'border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--elev-2)]'
                      : 'surface-sunken hover:border-[var(--border-strong)]',
                    anyRunning && !on && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="ingest_source"
                    value={s}
                    checked={on}
                    disabled={anyRunning && !on}
                    onChange={() => setSource(s)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-xl border transition',
                      on ? 'border-transparent bg-[var(--action)] text-[var(--on-action)]' : 'bg-[var(--surface-raised)] text-muted',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold tracking-tight">{SOURCE_FACE[s].name}</span>
                    <span className="text-subtle mt-0.5 block text-[12px]">{SOURCE_FACE[s].reach}</span>
                  </span>
                  {on && (
                    <Check aria-hidden className="absolute top-3.5 right-3.5 size-4 text-[var(--status-approved)]" />
                  )}
                </label>
              );
            })}
          </div>
          <p className="text-muted surface-sunken rounded-2xl border px-4 py-3 text-[13px] leading-relaxed text-pretty">
            <span className="font-semibold text-[var(--text-c)]">{SOURCE_META[source].label}.</span>{' '}
            {SOURCE_META[source].hint}
          </p>
        </div>
      </Card>

      {/* ── How ──────────────────────────────────────────────────────────── */}
      {source === 'mca_master' ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_0.08s_backwards] overflow-hidden">
            <CardTitle
              icon={<RefreshCw className="size-4" />}
              title="Sync automatically from data.gov.in"
              description="Every state this API can reach, no file needed."
            />
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <p className="text-muted text-[13px] leading-relaxed text-pretty">
                Complete for 10 small states/UTs (~16,000 companies), capped at the first 10,000 rows for the
                ~25 larger ones. That cap is data.gov.in&apos;s own search index, not this tool — the
                government platform refuses any request asking for more than 10,000 rows of a filtered result,
                and no combination of its filters gets a state like Maharashtra (821,545 companies) under that.
                Real completeness for a large state needs a paid MCA21 export or a licensed vendor; this gets
                everything free access can reach.
              </p>
              <HowLong>Roughly 20&ndash;40 minutes. Keep this tab open.</HowLong>
              {mcaResumeCount > 0 && !mcaSyncing && (
                <ResumeNote>
                  {mcaResumeCount} of {KNOWN_STATES.length} states already done from a previous run — starting
                  again will pick up where it left off.
                </ResumeNote>
              )}
              <Button
                type="button"
                variant="primary"
                loading={mcaSyncing}
                disabled={mcaSyncing || busy}
                onClick={() => void syncMcaLive()}
              >
                {mcaResumeCount > 0 ? 'Resume automatic sync' : 'Sync automatically'}
              </Button>
              {mcaSyncProgress && (
                <ProgressMeter
                  label={`State ${mcaSyncProgress.stateIndex + 1} of ${KNOWN_STATES.length} · ${mcaSyncProgress.stateName}`}
                  done={mcaSyncProgress.rowsDone}
                  total={mcaSyncProgress.reachable}
                  unit="reachable rows"
                  locale="en-IN"
                />
              )}
            </div>
          </Card>

          <Card className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_0.16s_backwards] overflow-hidden">
            <CardTitle
              icon={<FileSpreadsheet className="size-4" />}
              title="Or upload a fuller export"
              description="A company master file from elsewhere, read in this browser and sent in batches."
            />
            <form onSubmit={submitMcaFile} className="space-y-4 px-5 py-5 sm:px-6">
              <Field label="Company master file (.csv or .xlsx)" htmlFor="ingest_file" hint={`Up to ${MAX_MCA_FILE_MB} MB. data.gov.in publishes this per state.`}>
                <Input
                  key={inputKey}
                  id="ingest_file"
                  type="file"
                  accept=".csv,.txt,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Button type="submit" variant="secondary" loading={busy} disabled={!file || mcaSyncing}>
                Run ingest
              </Button>
              {progress && (
                <ProgressMeter
                  label={file?.name ?? 'Writing rows'}
                  done={progress.done}
                  total={progress.total}
                  unit="rows written"
                  locale="en-IN"
                />
              )}
            </form>
          </Card>
        </div>
      ) : (
        <div className={cn('grid gap-6 lg:items-start', source === 'edgar' && 'lg:grid-cols-2')}>
          <Card className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_0.08s_backwards] overflow-hidden">
            <CardTitle
              icon={<ListPlus className="size-4" />}
              title={source === 'edgar' ? 'Fetch a few by CIK' : 'Fetch by NSE symbol'}
              description="Paste identifiers to pull just those companies. The quickest way to test a source."
            />
            <form onSubmit={submitIdentifiers} className="space-y-4 px-5 py-5 sm:px-6">
              <Field label="Identifiers, comma or line separated" htmlFor="ingest_identifiers">
                <Textarea
                  id="ingest_identifiers"
                  rows={4}
                  placeholder={IDENTIFIER_PLACEHOLDER[source]}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Button type="submit" variant="primary" loading={busy} disabled={!text.trim() || edgarSyncing}>
                Run ingest
              </Button>
            </form>
          </Card>

          {source === 'edgar' && (
            <Card className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_0.16s_backwards] overflow-hidden">
              <CardTitle
                icon={<Globe className="size-4" />}
                title="Sync every SEC-registered company"
                description="The whole free universe, about 10,400 tickers, through this same pipeline."
              />
              <div className="space-y-4 px-5 py-5 sm:px-6">
                <p className="text-muted text-[13px] leading-relaxed text-pretty">
                  Pulls SEC&apos;s own free, keyless list of every registered ticker — Nasdaq, NYSE, OTC and
                  CBOE — and runs each one through this exact pipeline. Genuinely the whole universe, not a
                  partial slice.
                </p>
                <HowLong>
                  Roughly an hour at EDGAR&apos;s own rate limit. Keep this tab open; closing it is safe, and
                  re-running skips ahead to where it left off.
                </HowLong>
                {edgarResume > 0 && !edgarSyncing && (
                  <ResumeNote>
                    {edgarResume.toLocaleString('en-US')} companies already attempted — resuming continues from
                    there.
                  </ResumeNote>
                )}
                <Button
                  type="button"
                  variant="primary"
                  loading={edgarSyncing}
                  disabled={edgarSyncing || busy}
                  onClick={() => void syncEdgarUniverse(edgarResume)}
                >
                  {edgarResume > 0 ? 'Resume full sync' : 'Sync every SEC company'}
                </Button>
                {edgarSyncProgress && (
                  <ProgressMeter
                    label="SEC universe"
                    done={edgarSyncProgress.done}
                    total={edgarSyncProgress.total}
                    unit="companies attempted"
                    locale="en-US"
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── What happened ────────────────────────────────────────────────── */}
      {result && (
        <Card className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden">
          <CardTitle
            icon={<ClipboardCheck className="size-4" />}
            title="Last run"
            description={result.headline}
          />
          <div className="px-5 py-5 sm:px-6">
            {result.skipped.length > 0 ? (
              <>
                <p className="a-label mb-2">Skipped, by reason</p>
                <ul className="surface-sunken a-inner scroll-x-hint overflow-x-auto rounded-2xl border px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre">
                  {result.skipped.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted inline-flex items-center gap-2 text-sm">
                <Check className="size-4 text-[var(--status-approved)]" aria-hidden />
                Nothing was skipped.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * How each source looks on its card: a name short enough to sit on one line,
 * and what it reaches. The long label and hint stay in SOURCE_META, unchanged,
 * and are said in full under the cards for whichever one is picked.
 */
const SOURCE_FACE: Record<Source, { name: string; reach: string; icon: LucideIcon }> = {
  edgar: { name: 'SEC EDGAR', reach: 'US filers, by CIK', icon: Landmark },
  nse: { name: 'NSE', reach: 'Indian listed companies, by symbol', icon: CandlestickChart },
  mca_master: { name: 'MCA master data', reach: 'Indian company identity, by state', icon: Building2 },
};

/**
 * A long run's progress as a bar as well as a count. The count is the figure;
 * the bar is so that a glance across the room says how far it has got.
 */
function ProgressMeter({
  label,
  done,
  total,
  unit,
  locale,
}: {
  label: string;
  done: number;
  total: number;
  unit: string;
  locale: string;
}) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="surface-sunken a-inner rounded-2xl border p-4" role="status" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 truncate text-[13px] font-semibold">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{Math.round(share * 100)}%</p>
      </div>
      <div className="a-track mt-2.5 h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-[var(--action)] transition-[width] duration-500 ease-out"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="text-subtle mt-2 text-[12px] tabular-nums">
        {done.toLocaleString(locale)} of {total.toLocaleString(locale)} {unit}
      </p>
    </div>
  );
}

function HowLong({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted inline-flex items-start gap-2 text-[12.5px] leading-relaxed">
      <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function ResumeNote({ children }: { children: ReactNode }) {
  return (
    <p
      style={{ '--tone': 'var(--status-pending)' } as CSSProperties}
      className="tinted flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed"
    >
      <History className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

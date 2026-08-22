'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UploadCloud } from 'lucide-react';
import { runValuationIngest } from '@/app/actions/valuationIngest';
import { Button, Card, CardTitle, Select, Textarea } from '@/components/ui/primitives';

type Source = 'edgar' | 'nse';

const SOURCE_META: Record<Source, { label: string; placeholder: string; hint: string }> = {
  edgar: {
    label: 'SEC EDGAR (US filers, by CIK)',
    placeholder: '320193, 789019',
    hint: 'Works from here — no session to negotiate, and it is what the pipeline has been proven against (Apple, Microsoft). Good for testing the pipeline itself.',
  },
  nse: {
    label: 'NSE (Indian listed companies, by symbol)',
    placeholder: 'RELIANCE, TCS, INFY',
    hint: 'This machine is a datacentre address and NSE challenges those, so this will very likely refuse every symbol from here. If it does, the skip line below will say so rather than fail silently — that is the confirmation this page exists to get.',
  },
};

/**
 * Seeding the registry, from the operator's own session.
 *
 * A plain client form rather than a GET link like the comparables filter bar:
 * this triggers a write with real network calls to a rate-limited source, so it
 * is deliberately not something that fires again on every back-button press or
 * page refresh.
 */
export function IngestForm() {
  const router = useRouter();
  const [source, setSource] = useState<Source>('edgar');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ headline: string; skipped: string[] } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);

    const identifiers = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const res = await runValuationIngest({ source, identifiers });

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

  const meta = SOURCE_META[source];

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<UploadCloud className="size-4" />}
        title="Seed the registry"
        description="Fetch real companies from a source and write them in, up to 25 at a time. This is what makes the comparables screen have something to show."
      />
      <form onSubmit={submit} className="space-y-3 px-5 py-4">
        <div className="w-full sm:w-96">
          <label htmlFor="ingest_source" className="text-subtle mb-1.5 block text-xs font-medium">
            Source
          </label>
          <Select
            id="ingest_source"
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
          >
            {(Object.keys(SOURCE_META) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_META[s].label}
              </option>
            ))}
          </Select>
          <p className="text-subtle mt-1.5 text-xs leading-snug">{meta.hint}</p>
        </div>

        <div>
          <label htmlFor="ingest_identifiers" className="text-subtle mb-1.5 block text-xs font-medium">
            Identifiers, comma or line separated
          </label>
          <Textarea
            id="ingest_identifiers"
            rows={3}
            placeholder={meta.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <Button type="submit" variant="primary" loading={busy} disabled={!text.trim()}>
          Run ingest
        </Button>
      </form>

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

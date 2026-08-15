import { AlertTriangle, Bug, Globe, Server } from 'lucide-react';
import { readErrors } from '@/lib/errors/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { NUM, Pill, ago } from '@/components/analytics/Figures';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Errors' };
export const dynamic = 'force-dynamic';

/**
 * What actually broke, in one place.
 *
 * error.tsx and global-error.tsx already caught these; this is the first place
 * anybody but the visitor holding that exact tab gets to read them. atrack and
 * track write here too, for the same failures they have always deliberately
 * hidden from whoever was on the page at the time — see migration 0011.
 */
export default async function ErrorsPage() {
  const errors = await readErrors();
  const serverCount = errors.filter((e) => e.scope === 'server').length;
  const clientCount = errors.length - serverCount;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visitor Intelligence"
        title="What broke"
        description="Every error caught by a page boundary or swallowed by a route handler, most recent first."
      />

      <div className="surface-lit flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl px-5 py-4">
        <Stat label="Total" value={errors.length} tone="var(--status-rejected)" />
        <Stat label="Server-side" value={serverCount} tone="var(--h-indigo)" />
        <Stat label="Client-side" value={clientCount} tone="var(--h-cyan)" />
      </div>

      {errors.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={<AlertTriangle className="size-6" />}
            title="Nothing caught yet"
            description="Either nothing has broken, or migration 0011 has not been applied to this database yet."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {errors.map((error) => (
              <li key={error.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <span
                  className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border"
                  style={{
                    color: error.scope === 'server' ? 'var(--h-indigo)' : 'var(--h-cyan)',
                    borderColor: 'var(--border-c)',
                  }}
                >
                  {error.scope === 'server' ? (
                    <Server className="size-3.5" aria-hidden />
                  ) : (
                    <Globe className="size-3.5" aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-pretty">{error.message}</p>
                    <Pill tone={error.scope === 'server' ? 'var(--h-indigo)' : 'var(--h-cyan)'}>
                      {error.scope}
                    </Pill>
                  </div>
                  <p className={cn(NUM, 'text-subtle mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]')}>
                    {error.route && <span>{error.route}</span>}
                    <span>{ago(error.occurred_at)}</span>
                    {error.user_email && <span>{error.user_email}</span>}
                    {error.digest && <span>#{error.digest}</span>}
                  </p>
                  {error.stack && (
                    <details className="mt-2">
                      <summary className="text-subtle cursor-pointer text-[11px] select-none hover:text-[var(--text-c)]">
                        Stack
                      </summary>
                      <pre className="text-subtle mt-2 max-h-64 overflow-auto rounded-lg bg-[var(--surface-sunken)] p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardTitle
          title="Why an error might be silent everywhere else"
          description="Worth reading once, so an empty screen elsewhere doesn't read as an outage."
          icon={<Bug className="size-4" />}
        />
        <p className="text-muted px-5 py-4 text-[12.5px] leading-relaxed text-pretty">
          The visitor beacon and the signed-in page-view endpoint both answer{' '}
          <span className="font-mono">{'{ ok: true }'}</span> no matter what happened inside them, on
          purpose — a tracking call is never worth a visible failure. This screen is where those
          failures actually go instead of nowhere.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="h-8 w-[3px] rounded-full" style={{ background: tone }} />
      <span>
        <span className={cn(NUM, 'block text-[20px] leading-none font-semibold')}>
          {value.toLocaleString('en-IN')}
        </span>
        <span className="text-subtle mt-1 block text-[11px]">{label}</span>
      </span>
    </span>
  );
}

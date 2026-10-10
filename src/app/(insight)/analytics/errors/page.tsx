import { AlertTriangle, Bug, Globe, Server, ShieldCheck } from 'lucide-react';
import { readErrors } from '@/lib/errors/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { NUM, Pill, ago } from '@/components/analytics/Figures';
import { SummaryStrip } from '@/components/analytics/Strip';
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

      <SummaryStrip
        cells={[
          {
            label: 'Caught',
            value: errors.length.toLocaleString('en-IN'),
            note: errors.length === 0 ? 'Nothing on record' : `Latest ${ago(errors[0].occurred_at)}`,
            strong: errors.length > 0,
          },
          {
            label: 'Server-side',
            value: serverCount.toLocaleString('en-IN'),
            note: 'Route handlers and server components',
            tone: 'var(--h-indigo)',
          },
          {
            label: 'Client-side',
            value: clientCount.toLocaleString('en-IN'),
            note: 'Caught by a page boundary in a browser',
            tone: 'var(--h-cyan)',
          },
        ]}
      />

      {errors.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={<ShieldCheck className="size-6" />}
            title="Nothing caught yet"
            description="Either nothing has broken, or migration 0011 has not been applied to this database yet."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardTitle
            icon={<AlertTriangle className="size-4" />}
            title="Most recent first"
            description="Open a stack to read where it came from. The colour and the label both say which side it broke on."
          />
          <ul className="stagger divide-y">
            {errors.map((error) => (
              <li
                key={error.id}
                className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-[var(--surface-sunken)] sm:px-6"
              >
                <span
                  style={{ ['--tone' as string]: error.scope === 'server' ? 'var(--h-indigo)' : 'var(--h-cyan)' }}
                  className="tinted mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border"
                >
                  {error.scope === 'server' ? (
                    <Server className="size-3.5" aria-hidden />
                  ) : (
                    <Globe className="size-3.5" aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 text-[13.5px] font-semibold break-words text-pretty">{error.message}</p>
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
                      <pre className="surface-sunken text-subtle mt-2 max-h-64 overflow-auto rounded-xl border p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
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
        <p className="text-muted px-5 py-5 text-[13px] sm:px-6 leading-relaxed text-pretty">
          The visitor beacon and the signed-in page-view endpoint both answer{' '}
          <span className="font-mono">{'{ ok: true }'}</span> no matter what happened inside them, on
          purpose — a tracking call is never worth a visible failure. This screen is where those
          failures actually go instead of nowhere.
        </p>
      </Card>
    </div>
  );
}

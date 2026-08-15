import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Fingerprint,
  Flame,
  Monitor,
  MousePointerClick,
  Route,
  Search,
} from 'lucide-react';
import { parseCta, summarise } from '@/lib/analytics/aggregate';
import { readIdentities, readVisitorViewsFor } from '@/lib/analytics/store';
import { readGraph, resolveFromGraph } from '@/lib/analytics/graph';
import { resolveVisitor } from '@/lib/analytics/resolve';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle } from '@/components/ui/primitives';
import { Identity, Reasons } from '@/components/analytics/Company';
import { Enrich } from '@/components/analytics/Enrich';
import { IntentBreakdown } from '@/components/analytics/Intent';
import { Dot, NUM, Pill, ago, duration, number } from '@/components/analytics/Figures';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Visitor' };
export const dynamic = 'force-dynamic';

/**
 * One person's whole journey.
 *
 * Read forwards, because that is how it happened. Each stop carries the three
 * numbers that say whether it was a visit or a read — how long, how much of
 * that was attention, and how far down the page they got — and any call to
 * action they pressed while they were there.
 *
 * The reasoning panel is not an appendix. Somebody arriving here has usually
 * arrived because a row surprised them, and the question they have is "why does
 * it think that". Every step the engine took is written down, including the one
 * that decided not to name anybody.
 */
export default async function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visitorId = decodeURIComponent(id);

  const rows = await readVisitorViewsFor(visitorId);
  const summary = summarise(rows);
  if (!summary) notFound();

  const [record, graph, identities] = await Promise.all([
    resolveVisitor(summary),
    readGraph(),
    readIdentities(),
  ]);

  const person = resolveFromGraph(graph, visitorId);
  const declared = identities.filter((i) => i.visitor_id === visitorId);
  const journey = [...rows].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const searches = [
    ...new Set(journey.flatMap((r) => (r.search_terms ?? '').split('|')).map((t) => t.trim()).filter(Boolean)),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/analytics/visitors" className="inline-flex items-center gap-1.5 hover:underline">
            <ArrowLeft className="size-3" aria-hidden />
            All visitors
          </Link>
        }
        title="One visitor, end to end"
        description={`First seen ${ago(summary.firstSeen)}, last seen ${ago(summary.lastSeen)}. ${number(summary.sessions)} ${summary.sessions === 1 ? 'visit' : 'visits'} and ${number(summary.views)} pages.`}
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="overflow-hidden">
          <CardTitle icon={<Fingerprint className="size-4" />} title="Who this is" />
          <div className="space-y-4 px-5 py-4">
            <Identity resolution={record.resolution} company={record.company} person={person} />

            {person.resolved ? (
              <p className="text-muted text-[12px] leading-relaxed text-pretty">
                Identified from something they gave us themselves, not inferred. The link is
                deterministic, which is the only kind allowed to attach a name to a browser.
              </p>
            ) : (
              <p className="text-muted text-[12px] leading-relaxed text-pretty">
                {person.reason} Cold identification of somebody who has never interacted with us
                needs a licensed identity graph or a data-sharing co-op; the plug point for one
                exists and nothing is currently wired into it.
              </p>
            )}

            {declared.length > 0 && (
              <ul className="space-y-2 border-t pt-4">
                {declared.map((row) => (
                  <li key={row.id} className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate">
                      {row.email ?? row.full_name ?? 'Identified'}
                      <span className="text-subtle ml-2">via {row.source.replace('_', ' ')}</span>
                    </span>
                    <span className="text-subtle shrink-0">{ago(row.identified_at)}</span>
                  </li>
                ))}
              </ul>
            )}

            {record.resolution && (
              <div className="border-t pt-4">
                <Reasons resolution={record.resolution} />
              </div>
            )}

            {record.resolution?.identified && record.resolution.domain && (
              <div className="border-t pt-4">
                <Enrich
                  domain={record.resolution.domain}
                  name={record.company?.name ?? record.resolution.companyName ?? record.resolution.domain}
                />
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardTitle icon={<MousePointerClick className="size-4" />} title="How close they look" />
            <div className="px-5 py-4">
              <IntentBreakdown intent={record.intent} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardTitle icon={<Monitor className="size-4" />} title="Where they came in" />
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 px-5 py-4 text-[12px]">
              <Row label="Landed on" value={summary.landing ?? '—'} mono />
              <Row label="Referred by" value={summary.referrer} />
              <Row label="Campaign" value={summary.campaign ?? 'None'} />
              <Row label="Device" value={summary.device ?? 'Unknown'} />
              <Row label="Attention" value={duration(summary.engagedSeconds)} mono />
              <Row label="Address" value={summary.ip ?? 'Not recorded'} mono />
            </dl>
          </Card>

          {(searches.length > 0 || summary.rageClicks > 0) && (
            <Card className="overflow-hidden">
              <CardTitle title="Signals worth reading" />
              <div className="space-y-3 px-5 py-4">
                {searches.length > 0 && (
                  <div>
                    <p className="a-label text-subtle mb-2 flex items-center gap-1.5">
                      <Search className="size-3" aria-hidden />
                      Searched for
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {searches.map((term) => (
                        <Pill key={term} tone="var(--h-cyan)">
                          {term}
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
                {summary.rageClicks > 0 && (
                  <p className="flex items-center gap-2 text-[12px]">
                    <Flame className="size-3.5 shrink-0" style={{ color: 'var(--status-rejected)' }} aria-hidden />
                    {number(summary.rageClicks)} frustrated {summary.rageClicks === 1 ? 'click' : 'clicks'}.
                    Something on one of these pages was not responding.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Route className="size-4" />}
          title="The journey"
          description="In the order it happened. Attention is the part of the time on a page that was genuinely spent on it."
        />

        <ol className="relative px-5 py-4">
          {/* One rule down the left, so the stops read as a sequence rather
              than as a list of unrelated rows. */}
          <span aria-hidden className="absolute top-6 bottom-6 left-[27px] w-px bg-[var(--border-c)]" />

          {journey.map((stop, index) => {
            const ctas = parseCta(stop.cta_clicks);
            const newSession = index === 0 || journey[index - 1].session_id !== stop.session_id;

            return (
              <li key={stop.id} className="relative flex gap-4 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'relative z-10 mt-1 grid size-3.5 shrink-0 place-items-center rounded-full border-2 border-[var(--surface-raised)]',
                  )}
                  style={{ background: newSession ? 'var(--color-brand-500)' : 'var(--border-strong)' }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={cn(NUM, 'text-[13px] font-medium')}>{stop.page_url}</span>
                    <span className="text-subtle text-[11px]">
                      {new Date(stop.occurred_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-subtle mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    {newSession && (
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand-500)]">
                        <Dot tone="var(--color-brand-500)" />
                        New visit
                      </span>
                    )}
                    <span className={NUM}>{duration(stop.engaged_time_s)} attention</span>
                    <span className={NUM}>{stop.max_scroll_pct}% down</span>
                    {stop.total_clicks > 0 && <span className={NUM}>{stop.total_clicks} clicks</span>}
                    {stop.form_stage && <span>Form: {stop.form_stage}</span>}
                  </p>

                  {ctas.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ctas.map((cta) => (
                        <Pill key={cta.label} tone="var(--h-emerald)">
                          {cta.label}
                          {cta.count > 1 && <span className={NUM}>×{cta.count}</span>}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-subtle text-[11px]">{label}</dt>
      <dd className={cn('mt-0.5 truncate', mono && NUM)} title={value}>
        {value}
      </dd>
    </div>
  );
}

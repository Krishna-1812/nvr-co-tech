import Link from 'next/link';
import { ArrowUpRight, Building2 } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/primitives';
import { PageHeader } from '@/components/PageHeader';
import { duration, number } from '@/components/analytics/Figures';
import { SummaryStrip } from '@/components/analytics/Strip';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { buildPeople } from '@/lib/analytics/people';
import { summariseTenants } from '@/lib/analytics/tenants';
import {
  readAgentRuns,
  readIdentities,
  readSignedInViews,
  readTenants,
} from '@/lib/analytics/store';

export const metadata = { title: 'Organisations' };
export const dynamic = 'force-dynamic';

/**
 * Every tenant, ranked by how much they are actually using it.
 *
 * Server-rendered whole, with no client fetch, because there is nothing on it to
 * interact with: a list of cards, each a link. The interesting screen is the one
 * behind each card.
 *
 * Tenants with no activity are kept and shown as such. An organisation that
 * signed up and never came back is the most actionable row here, and dropping it
 * for having nothing to plot would hide precisely the accounts worth a call.
 *
 * ── What the cards count, and what they used to ─────────────────────────────
 *
 * Page views, tool opens and time on page — which meant this list was ranking
 * customers by how much of our own marketing they had read. A tenant that
 * submits forty vouchers a month and never visits a public page came bottom.
 *
 * It now leads with work done: vouchers submitted and vouchers paid, from the
 * activation counts that arrive with the tenant list. Page views are still read,
 * because "last active" is better answered by them than by milestones — somebody
 * signing in to look at the register generates a view and no event — but they no
 * longer decide the order.
 */
export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);

  const [signedIn, identities, runs, tenants] = await Promise.all([
    readSignedInViews(days),
    readIdentities(),
    readAgentRuns(days),
    readTenants(),
  ]);

  const people = buildPeople({
    signedIn,
    identities,
    runs,
    profiles: tenants.members,
    // No pre-signup linking on this page: the question is how a tenant is being
    // used, not how its people were acquired.
    journeyCap: 1,
  });

  const summaries = summariseTenants({
    organizations: tenants.organizations,
    members: tenants.members,
    people,
  }).sort((a, b) => {
    const work = (id: string) => {
      const row = tenants.counts.get(id);
      return row ? row.vouchers_submitted * 10 + row.vouchers_paid : 0;
    };
    return work(b.id) - work(a.id) || b.pageViews - a.pageViews || a.name.localeCompare(b.name);
  });

  // Organisations that have never done anything at all — no voucher, no
  // reconciliation, nothing. Lifetime rather than windowed on purpose: a tenant
  // that was busy in June and silent since is a different problem from one that
  // never started, and only the second belongs in this count.
  const quiet = summaries.filter((t) => {
    const row = tenants.counts.get(t.id);
    return !row || row.vouchers_drafted + row.reconciliations_saved === 0;
  }).length;

  // Totals for the strip, summed from the same per-tenant counts the cards show,
  // so the strip and the cards cannot disagree.
  const submittedAll = summaries.reduce((n, t) => n + (tenants.counts.get(t.id)?.vouchers_submitted ?? 0), 0);
  const paidAll = summaries.reduce((n, t) => n + (tenants.counts.get(t.id)?.vouchers_paid ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenants"
        title="Who is actually using it"
        description="One card per organisation on the platform, ranked by work done rather than pages read. The counts come from a function that returns aggregates only — no voucher amount, vendor or number reaches this screen."
        action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/orgs" />}
      />

      {summaries.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={<Building2 className="size-6" />}
            title="No organisations yet"
            description="An organisation is created the first time somebody signs up and names one. Until then there is nothing to compare."
          />
        </Card>
      ) : (
        <>
          <SummaryStrip
            cells={[
              {
                label: 'Organisations',
                value: number(summaries.length),
                note: 'Every tenant, active or not',
                strong: true,
              },
              {
                label: 'Vouchers submitted',
                value: number(submittedAll),
                note: 'Across every organisation, ever',
                tone: 'var(--h-indigo)',
              },
              {
                label: 'Vouchers paid',
                value: number(paidAll),
                note: 'The end of the workflow',
                tone: 'var(--status-approved)',
              },
              {
                label: 'Never drafted',
                value: number(quiet),
                note: quiet === 0 ? 'Every one has started' : 'Signed up and stopped. Worth a call',
                tone: quiet > 0 ? 'var(--status-warn)' : 'var(--status-approved)',
              },
            ]}
          />

          <ul className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summaries.map((tenant) => (
              <li key={tenant.id} className="min-w-0">
                <Link
                  href={`/analytics/orgs/${tenant.id}?days=${days}`}
                  className="surface-lit a-ring a-lift group relative flex h-full flex-col overflow-hidden rounded-3xl"
                  style={{ ['--tone' as string]: tenant.accent }}
                >
                  <span
                    aria-hidden
                    className="h-[3px] shrink-0"
                    style={{
                      background: `linear-gradient(90deg, color-mix(in oklab, ${tenant.accent} 35%, transparent), ${tenant.accent})`,
                    }}
                  />

                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      {/* Tinted by the tenant's own colour rather than filled with
                          it: a filled mark needs a label colour chosen per hue
                          and per theme, and the tint carries the colour without. */}
                      <span
                        aria-hidden
                        className="tinted a-inner grid size-11 shrink-0 place-items-center rounded-2xl border text-[13px] font-bold tracking-tight"
                      >
                        {initials(tenant.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold tracking-tight">{tenant.name}</span>
                        <span className="text-subtle block text-[11px]">
                          Joined{' '}
                          {new Date(tenant.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'Asia/Kolkata',
                          })}
                        </span>
                      </span>
                    </div>

                    <div className="mt-5 mb-5 grid grid-cols-3 gap-2">
                      <Box
                        label="People"
                        value={number(tenants.counts.get(tenant.id)?.members ?? tenant.people)}
                      />
                      <Box
                        label="Sent"
                        value={number(tenants.counts.get(tenant.id)?.vouchers_submitted ?? 0)}
                      />
                      <Box
                        label="Paid"
                        value={number(tenants.counts.get(tenant.id)?.vouchers_paid ?? 0)}
                      />
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-dashed pt-4">
                      <span className="text-subtle text-[11px]">
                        {lastActive(tenant.lastSeen, tenants.counts.get(tenant.id)?.last_event)}
                        {tenant.seconds > 0 && ` · ${duration(tenant.seconds)}`}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold">
                        Open
                        <ArrowUpRight
                          className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <span className="surface-sunken block min-w-0 rounded-xl border px-2 py-2.5 text-center">
      <span className="block text-[1.2rem] leading-none font-semibold tracking-tight tabular-nums">{value}</span>
      <span className="a-label mt-1.5 block truncate">{label}</span>
    </span>
  );
}

/**
 * When this tenant was last seen doing anything.
 *
 * Two sources, because neither covers the other: a page view happens whenever
 * somebody signs in and looks around, and a milestone happens when they get
 * something done. Somebody reading the register all afternoon produces views and
 * no milestone; a voucher approved from an email link could produce the reverse.
 * The later of the two is the honest answer.
 */
function lastActive(seen: string | null, event: string | null | undefined): string {
  const times = [seen, event].filter((v): v is string => Boolean(v)).map((v) => new Date(v));
  if (times.length === 0) return 'Never active';

  const latest = new Date(Math.max(...times.map((d) => d.getTime())));
  return `Last active ${latest.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })}`;
}

/** Two letters from an organisation's name, for the mark on its card. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}

import Link from 'next/link';
import { ArrowUpRight, Building2 } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/primitives';
import { PageHeader } from '@/components/PageHeader';
import { duration, number, NUM } from '@/components/analytics/Figures';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { buildPeople } from '@/lib/analytics/people';
import { summariseTenants } from '@/lib/analytics/tenants';
import {
  readAgentRuns,
  readIdentities,
  readSignedInViews,
  readTenants,
} from '@/lib/analytics/store';
import { cn } from '@/lib/utils';

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
  });

  const quiet = summaries.filter((t) => t.pageViews === 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenants"
        title="Who is actually using it"
        description="One card per organisation on the platform. Activity is attributed through the people who belong to it, since the page-view log is not tenant-scoped and should not be."
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
          <p className="text-subtle text-[12px]">
            {number(summaries.length)} {summaries.length === 1 ? 'organisation' : 'organisations'}
            {quiet > 0 && (
              <>
                {' · '}
                <span className="text-[var(--h-amber)]">
                  {number(quiet)} with no activity in this window
                </span>
              </>
            )}
          </p>

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summaries.map((tenant) => (
              <li key={tenant.id}>
                <Link
                  href={`/analytics/orgs/${tenant.id}?days=${days}`}
                  className="hover-lift a-ring group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-[var(--surface-raised)]"
                  style={{ ['--tone' as string]: tenant.accent }}
                >
                  <span
                    aria-hidden
                    className="h-[3px] shrink-0"
                    style={{
                      background: `linear-gradient(90deg, color-mix(in oklab, ${tenant.accent} 35%, transparent), ${tenant.accent})`,
                    }}
                  />

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${tenant.accent}, color-mix(in oklab, ${tenant.accent} 55%, black))`,
                        }}
                      >
                        {initials(tenant.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{tenant.name}</span>
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

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <Box label="Views" value={number(tenant.pageViews)} />
                      <Box label="People" value={number(tenant.people)} />
                      <Box label="Tools" value={number(tenant.runs)} />
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <span className="text-subtle text-[11px]">
                        {tenant.lastSeen
                          ? `Last active ${new Date(tenant.lastSeen).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'Asia/Kolkata',
                            })}`
                          : 'No activity yet'}
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
    <span className="surface-sunken block rounded-lg border px-2 py-1.5 text-center">
      <span className={cn(NUM, 'block text-[15px] font-semibold')}>{value}</span>
      <span className="a-label mt-0.5 block text-[9px]">{label}</span>
    </span>
  );
}

/** Two letters from an organisation's name, for the mark on its card. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}

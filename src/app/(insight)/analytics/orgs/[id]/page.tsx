import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/primitives';
import { BarList } from '@/components/analytics/Charts';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { buildPeople, renderedAt, tally } from '@/lib/analytics/people';
import { activityByDay, tenantDetail } from '@/lib/analytics/tenants';
import {
  readAgentRuns,
  readIdentities,
  readSignedInViews,
  readStaffEmails,
  readTenants,
} from '@/lib/analytics/store';
import { TenantBoard } from './TenantBoard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizations } = await readTenants();
  const org = organizations.find((o) => o.id === id);
  return { title: org ? org.name : 'Organisation' };
}

/**
 * One tenant.
 *
 * The whole page turns on one distinction, which is why the segments are the
 * first thing under the figures: activity by the people who bought this, versus
 * activity by us inside their account. A customer-success number that quietly
 * folds our own demonstrating and fixing into "adoption" is worse than no number,
 * because somebody will present it.
 */
export default async function TenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  const days = windowFrom((await searchParams).days);

  const [signedIn, identities, runs, tenants, staffEmails] = await Promise.all([
    readSignedInViews(days),
    readIdentities(),
    readAgentRuns(days),
    readTenants(),
    readStaffEmails(),
  ]);

  const organization = tenants.organizations.find((o) => o.id === id);
  if (!organization) notFound();

  const people = buildPeople({
    signedIn,
    identities,
    runs,
    profiles: tenants.members,
  });

  const detail = tenantDetail({
    organization,
    members: tenants.members,
    people,
    staffEmails,
  });

  const now = renderedAt();

  // Scoped to this tenant's own people before tallying, so a busy tenant next
  // door cannot appear in this one's browser breakdown.
  const theirEmails = new Set(
    [...detail.segments.them, ...detail.segments.us].map((p) => p.email),
  );
  const theirViews = signedIn.filter(
    (r) => r.email && theirEmails.has(r.email.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/analytics/orgs?days=${days}`}
          className="a-ring text-muted inline-flex items-center gap-1.5 rounded-lg text-[11.5px] font-medium transition hover:text-[var(--text-c)]"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All organisations
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="a-label" style={{ color: detail.accent }}>
              Organisation
            </span>
            <h1 className="mt-1.5 text-[1.7rem] leading-tight tracking-tight text-pretty">
              {detail.name}
            </h1>
          </div>
          <WindowTabs current={days as 7 | 30 | 90} base={`/analytics/orgs/${id}`} />
        </div>
      </div>

      <TenantBoard
        detail={detail}
        perDay={activityByDay(detail, Math.min(days, 24), now)}
        days={days}
        now={now}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardTitle title="Most read" description="Pages opened by this organisation." />
          <BarList items={tally(theirViews.map((r) => r.page_title), 8)} tone={detail.accent} />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Browsers" description="Share of their page views." />
          <BarList items={tally(theirViews.map((r) => r.browser))} tone="var(--h-violet)" />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Devices" description="Share of their page views." />
          <BarList items={tally(theirViews.map((r) => r.device))} tone="var(--h-cyan)" />
        </Card>
      </section>
    </div>
  );
}

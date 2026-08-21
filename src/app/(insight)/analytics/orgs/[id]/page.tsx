import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/primitives';
import { BarList } from '@/components/analytics/Charts';
import { Fact } from '@/components/analytics/Activation';
import { number } from '@/components/analytics/Figures';
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

  const counts = tenants.counts.get(id);

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

      {/*
        * What they have actually done, as opposed to what they have looked at.
        *
        * Placed above the page-view breakdowns deliberately. Everything below is
        * about reading; this is about working, and for a tenant screen the second
        * is the question and the first is context. The figures are lifetime
        * rather than windowed because "has this tenant ever submitted anything"
        * does not become false when the date filter moves.
        */}
      <Card className="overflow-hidden">
        <CardTitle
          title="What they have done"
          description="Milestones recorded by the database itself, for the life of this organisation. No voucher amount, vendor or number is exposed here — the function behind it returns counts only."
        />
        {counts ? (
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="People" value={number(counts.members)} />
            <Fact
              label="Drafted"
              value={number(counts.vouchers_drafted)}
              tone="var(--status-draft)"
            />
            <Fact
              label="Submitted"
              value={number(counts.vouchers_submitted)}
              tone="var(--status-pending)"
            />
            <Fact
              label="Approved"
              value={number(counts.vouchers_approved)}
              tone="var(--status-approved)"
            />
            <Fact label="Paid" value={number(counts.vouchers_paid)} tone="var(--status-paid)" />
            <Fact label="Reconciled" value={number(counts.reconciliations_saved)} />
          </div>
        ) : (
          <p className="text-subtle px-5 py-8 text-center text-sm">
            No milestones recorded for this organisation.
          </p>
        )}
        {counts && (
          <div className="grid gap-4 border-t px-5 py-4 sm:grid-cols-3">
            <Fact
              label="Invites"
              value={
                counts.invites_sent === 0
                  ? number(counts.invites_accepted)
                  : `${counts.invites_accepted} of ${counts.invites_sent}`
              }
              says={
                counts.invites_sent === 0
                  ? 'Accepted. Sends were not recorded before migration 0026, so there is no rate yet.'
                  : 'Links used, out of links generated. An admin copies and sends them by hand.'
              }
            />
            <Fact
              label="Chapters added"
              value={number(counts.chapters_created)}
              says="Beyond the head office every workspace is given on creation."
            />
            <Fact
              label="Sent but never paid"
              value={number(Math.max(0, counts.vouchers_submitted - counts.vouchers_paid))}
              says="The gap between the two columns above. Some of it is work in progress; the rest is the queue nobody is being told about."
              tone={
                counts.vouchers_submitted - counts.vouchers_paid > 0
                  ? 'var(--status-warn)'
                  : undefined
              }
            />
          </div>
        )}
      </Card>

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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Globe, ListChecks, MonitorSmartphone } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/primitives';
import { BarList, ChartEmpty } from '@/components/analytics/Charts';
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
      {/*
        The tenant's own header: a lit panel in the organisation's colour, with
        its mark, rather than a bare title. Not a hero — the section has one, on
        the overview — but enough that landing here from a card reads as having
        opened that card.
      */}
      <header
        style={{ ['--tone' as string]: detail.accent }}
        className="surface-lit a-ring relative isolate animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden rounded-3xl"
      >
        <span
          aria-hidden
          className="a-orb -top-32 -left-20 size-80 opacity-[0.14]"
          style={{ background: 'radial-gradient(circle, var(--tone), transparent 68%)' }}
        />
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, color-mix(in oklab, var(--tone) 35%, transparent), var(--tone))' }}
        />
        <div className="relative p-5 sm:p-7">
          <Link
            href={`/analytics/orgs?days=${days}`}
            className="a-ring text-muted inline-flex items-center gap-1.5 rounded-lg text-[12px] font-medium transition hover:text-[var(--text-c)]"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            All organisations
          </Link>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden
                className="tinted a-inner grid size-14 shrink-0 place-items-center rounded-2xl border text-[17px] font-bold tracking-tight"
              >
                {initials(detail.name)}
              </span>
              <div className="min-w-0">
                <p className="a-label">
                  Organisation · joined{' '}
                  {new Date(detail.createdAt).toLocaleDateString('en-IN', {
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata',
                  })}
                </p>
                <h1 className="m-display mt-1.5 text-[clamp(1.6rem,3.2vw,2.15rem)] leading-tight text-balance break-words">
                  {detail.name}
                </h1>
              </div>
            </div>
            <WindowTabs current={days as 7 | 30 | 90} base={`/analytics/orgs/${id}`} />
          </div>
        </div>
      </header>

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
          icon={<ListChecks className="size-4" />}
          title="What they have done"
          description="Milestones recorded by the database itself, for the life of this organisation. No voucher amount, vendor or number is exposed here — the function behind it returns counts only."
        />
        {counts ? (
          <div className="grid grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
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
          <ChartEmpty>
            No milestones recorded for this organisation.
          </ChartEmpty>
        )}
        {counts && (
          <div className="surface-sunken grid gap-4 border-t px-5 py-5 sm:grid-cols-3 sm:px-6">
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

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<BookOpen className="size-4" />}
            title="Most read"
            description="Pages opened by this organisation."
          />
          <BarList items={tally(theirViews.map((r) => r.page_title), 8)} tone={detail.accent} />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle
            icon={<Globe className="size-4" />}
            title="Browsers"
            description="Share of their page views."
          />
          <BarList items={tally(theirViews.map((r) => r.browser))} tone="var(--h-violet)" />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle
            icon={<MonitorSmartphone className="size-4" />}
            title="Devices"
            description="Share of their page views."
          />
          <BarList items={tally(theirViews.map((r) => r.device))} tone="var(--h-cyan)" />
        </Card>
      </section>
    </div>
  );
}

/** Two letters from an organisation's name, for its mark. The same rule as the list's cards. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}

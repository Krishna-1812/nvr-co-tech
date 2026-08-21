import {
  AlarmClock,
  Building2,
  CheckCheck,
  CreditCard,
  GitBranch,
  Hourglass,
  Mail,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  readOperatorMembers,
  readOperatorOnboarding,
  readOperatorTenants,
  readProductEvents,
  readSignedInViews,
  readSpend,
  readStuckVouchers,
  readWorkflowStages,
} from '@/lib/analytics/store';
import {
  activation,
  activityByDay,
  approvalSplit,
  distinctVouchers,
  inviteFunnel,
  setupDepth,
  span,
  timeToValue,
  waitingOn,
} from '@/lib/analytics/funnel';
import { renderedAt } from '@/lib/analytics/people';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle, DataTable, Td, Th, Thead, Tr } from '@/components/ui/primitives';
import { Split, Trend } from '@/components/analytics/Charts';
import { ActivationFunnel, Fact } from '@/components/analytics/Activation';
import { NUM, Pill, ago, number } from '@/components/analytics/Figures';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Activation' };
export const dynamic = 'force-dynamic';

/**
 * The status token for a voucher state.
 *
 * A lookup rather than a nested ternary at the point of use, which had reached
 * four levels and was unreadable inside JSX.
 */
const STATE_TONE: Record<string, string> = {
  draft: 'var(--status-draft)',
  pending_first: 'var(--status-pending)',
  pending_second: 'var(--status-pending)',
  approved: 'var(--status-approved)',
  rejected: 'var(--status-rejected)',
  paid: 'var(--status-paid)',
};

const toneFor = (status: string): string => STATE_TONE[status] ?? 'var(--status-draft)';

/**
 * Whether the product works.
 *
 * Every other screen in this section is about people who are looking at the
 * site. This one is about whether the people who signed up ever got any value
 * out of it, which is the only question on the platform that a commercial
 * decision actually rests on.
 *
 * ── Where these numbers come from, and why they are trustworthy ─────────────
 *
 * Not from the application. Every figure here is a group-by over
 * `product_events`, which is written by triggers and SECURITY DEFINER functions
 * inside the database at the moment the thing happens. That has three
 * consequences worth stating, because they are the reason to believe this screen
 * over a hand-instrumented one:
 *
 *   * A new call site cannot forget to emit. The event is attached to the state
 *     change, not to the code path that requested it.
 *   * A client that dies mid-flight cannot skip it, because it is in the same
 *     transaction as the change it describes.
 *   * It cannot disagree with what the database actually did.
 *
 * The cost is that history begins when each trigger was installed: the six
 * events from 0022 have been recording since then, and the five from 0026 start
 * from today. Nothing can be backfilled, which is why the migration went in
 * before this page did.
 *
 * ── The window ─────────────────────────────────────────────────────────────
 *
 * The funnel ignores it. Activation is cumulative — an organisation that
 * onboarded in June and submits vouchers weekly has activated, and a thirty-day
 * window would file it under never-activated because its `organisation_created`
 * row is out of range. Only the trend line and the stuck-work threshold respond
 * to the tabs, and both say so.
 */
export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);

  const [events, tenants, members, onboarding, stages, stuck, views, spend] = await Promise.all([
    readProductEvents(),
    readOperatorTenants(),
    readOperatorMembers(),
    readOperatorOnboarding(),
    readWorkflowStages(),
    readStuckVouchers(days === 7 ? 7 : 14),
    readSignedInViews(days),
    readSpend(200),
  ]);

  const funnel = activation(events);
  const value = timeToValue(events);
  const invites = inviteFunnel(events);
  const split = approvalSplit(events);
  const depth = setupDepth(events);
  const now = renderedAt();

  const signedUp = funnel[0]?.reached ?? 0;
  const workspaces = funnel[1]?.reached ?? 0;
  const submitting = funnel[3]?.reached ?? 0;
  const paidVouchers = distinctVouchers(events, 'voucher_paid');
  const rejected = distinctVouchers(events, 'voucher_rejected');

  const waiting = stuck.reduce((n, row) => n + row.waiting, 0);

  /*
   * Stuck work, joined to whether anybody from that tenant has been around to
   * unstick it. The counts alone cannot tell a queue somebody is working through
   * from a queue nobody has been told about, and with notification email off the
   * second is the failure mode this product actually has.
   */
  const stalled = waitingOn({
    stuck,
    memberOrg: new Map(
      members
        .filter((m) => m.organization_id)
        .map((m) => [m.email.trim().toLowerCase(), m.organization_id!]),
    ),
    views,
    lastEventByOrg: new Map(tenants.map((t) => [t.organization_id, t.last_event])),
    now,
  });

  const unattended = stalled.filter((row) => row.silentDays === null || row.silentDays >= 3);
  const paidLookups = spend.length;
  const lookupsByOutcome: { label: string; count: number }[] = Object.entries(
    spend.reduce<Record<string, number>>((acc, row) => {
      acc[row.outcome] = (acc[row.outcome] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, count]) => ({ label, count }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Activation"
        title="Whether the product works"
        description="Every figure here is written by the database at the moment the thing happens, not by the app afterwards, so nothing on this page can be missed by a new call site or skipped by a browser that closed mid-request. The funnel is cumulative and ignores the window; the trend and the waiting-work threshold do not."
        action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/activation" />}
      />

      <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Card className="p-4">
          <Fact
            label="Signed up"
            value={number(signedUp)}
            says="Accounts that exist. Counted from the trigger on the auth table, so it cannot double-count."
          />
        </Card>
        <Card className="p-4">
          <Fact
            label="Started a workspace"
            value={number(workspaces)}
            says={
              signedUp
                ? `${funnel[1]?.fromPrevious ?? 0}% of the people who signed up. The rest are on the list below.`
                : 'Nobody has onboarded yet.'
            }
            tone="var(--h-violet)"
          />
        </Card>
        <Card className="p-4">
          <Fact
            label="Ever submitted"
            value={number(submitting)}
            says="Organisations that got a voucher past every validation the database enforces. This is the line between trying the product and using it."
            tone="var(--h-emerald)"
          />
        </Card>
        <Card className="p-4">
          <Fact
            label="Time to first submit"
            value={span(value.medianHours)}
            says={
              value.samples
                ? `Median across ${number(value.samples)} ${value.samples === 1 ? 'organisation' : 'organisations'}. Slowest was ${span(value.slowestHours)}.`
                : 'No organisation has both a start and a first submission yet.'
            }
            tone="var(--h-cyan)"
          />
        </Card>
        <Card className="p-4">
          <Fact
            label="Invites accepted"
            value={invites.rate === null ? `${number(invites.accepted)}` : `${invites.rate}%`}
            says={
              invites.rate === null
                ? `${number(invites.accepted)} accepted, and no rate yet: invite_sent only began recording with migration 0026, so acceptances have no denominator until the first new invite goes out.`
                : `${number(invites.accepted)} of ${number(invites.sent)} links were used. Nothing emails them — an admin copies the link and sends it themselves.`
            }
            tone="var(--h-amber)"
          />
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<TrendingUp className="size-4" />}
          title="The activation funnel"
          description="Five steps, each of which genuinely requires the one above it. Chapter setup and approval are left out because neither is a prerequisite, and both are reported separately below."
        />
        <ActivationFunnel stages={funnel} />
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<GitBranch className="size-4" />}
            title="How paid vouchers got there"
            description="Read from the flag the trigger sets per voucher, not inferred from a missing approval event — an organisation that switched approval on last week has vouchers of both shapes."
          />
          <Split
            items={[
              { label: 'Approved by somebody', count: split.approved },
              { label: 'Straight through, approval off', count: split.straightThrough },
            ].filter((item) => item.count > 0)}
            empty="No voucher has reached paid yet."
          />
          <div className="grid gap-3 border-t px-5 py-4 sm:grid-cols-3">
            <Fact
              label="Vouchers paid"
              value={number(paidVouchers)}
              says="Distinct vouchers, so a resubmission is not counted twice."
            />
            <Fact
              label="Ever rejected"
              value={number(rejected)}
              says="Sent back at least once. Not a failure — it is the control working."
              tone={rejected > 0 ? 'var(--status-rejected)' : undefined}
            />
            <Fact
              label="Chapters set up"
              value={number(depth.chapters)}
              /*
               * Two different subjects, so the sentence has to name both. It read
               * "7 ... 1 organisation has added one", where the figure counts
               * chapters and the "one" counted a chapter as well, which put a 7
               * and a one in the same breath about the same thing.
               */
              says={`Beyond the head office every workspace is given, across ${number(depth.organisations)} ${depth.organisations === 1 ? 'organisation' : 'organisations'}.`}
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Hourglass className="size-4" />}
            title="How long each step takes"
            description="Median and the ninetieth percentile, because the tail here is made of vouchers somebody forgot about and a mean would report the tail as normal."
          />
          {stages.length === 0 ? (
            <p className="text-subtle px-5 py-8 text-center text-sm text-pretty">
              No voucher has moved through two states yet, so there is nothing to time.
            </p>
          ) : (
            <DataTable>
              <Thead>
                <tr>
                  <Th>Step</Th>
                  <Th align="right">Vouchers</Th>
                  <Th align="right">Median</Th>
                  <Th align="right">Slowest tenth</Th>
                </tr>
              </Thead>
              <tbody className="divide-y">
                {stages.map((row) => (
                  <Tr key={row.stage}>
                    <Td className="text-[12.5px]">{row.stage}</Td>
                    <Td align="right" className={NUM}>
                      {number(row.samples)}
                    </Td>
                    <Td align="right" className={NUM}>
                      {span(row.median_hours)}
                    </Td>
                    <Td align="right" className={NUM}>
                      {span(row.p90_hours)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<AlarmClock className="size-4" />}
          title="Waiting on somebody"
          description={`Vouchers that have sat in one state for more than ${days === 7 ? 'a week' : 'a fortnight'}, ordered by how long it has been since anybody from that organisation was around rather than by how many are waiting. Nine somebody is working through is a queue; one nobody has been told about is the problem.`}
          action={
            waiting > 0 ? (
              <Pill tone={unattended.length > 0 ? 'var(--status-rejected)' : 'var(--status-warn)'}>
                {number(waiting)} waiting
              </Pill>
            ) : undefined
          }
        />
        {stalled.length === 0 ? (
          <p className="text-subtle px-5 py-8 text-center text-sm text-pretty">
            Nothing has stopped moving. Worth knowing what this table cannot catch: nothing
            currently tells an approver a voucher is waiting, because notification email is switched
            off. An empty table here is the only place that absence would ever show up.
          </p>
        ) : (
          <div className="scroll-x-hint">
            <DataTable>
              <Thead>
                <tr>
                  <Th>Organisation</Th>
                  <Th>Sitting in</Th>
                  <Th align="right">Waiting</Th>
                  <Th align="right">Oldest</Th>
                  <Th align="right">Last seen</Th>
                </tr>
              </Thead>
              <tbody className="divide-y">
                {stalled.map((row) => {
                  // Three days is the line. Below it somebody plausibly has not
                  // got to it yet; above it, in a product that sends no email,
                  // the likeliest explanation is that nobody knows.
                  const unseen = row.silentDays === null || row.silentDays >= 3;

                  return (
                    <Tr key={row.organizationId}>
                      <Td className="text-[12.5px] font-medium">
                        {row.organisation}
                        {unseen && (
                          <span
                            className="mt-0.5 block text-[11px] font-normal"
                            style={{ color: 'var(--status-rejected)' }}
                          >
                            nobody has been in to see it
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {row.states.map((state) => (
                            <Pill key={state.status} tone={toneFor(state.status)}>
                              {state.waiting} {state.status.replace('_', ' ')}
                            </Pill>
                          ))}
                        </span>
                      </Td>
                      <Td align="right" className={NUM}>
                        {number(row.waiting)}
                      </Td>
                      <Td align="right" className={NUM}>
                        {number(row.oldestDays)} days
                      </Td>
                      <Td
                        align="right"
                        className={cn(NUM, 'whitespace-nowrap')}
                        style={unseen ? { color: 'var(--status-rejected)' } : undefined}
                      >
                        {row.lastSeen === null ? 'never' : ago(row.lastSeen, now)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Building2 className="size-4" />}
          title="Every organisation"
          description="Read through a function that returns counts and nothing else. The tenant screens used to read the tables directly, which is why they only ever showed one row: the policy on organizations scopes it to your own."
        />
        {tenants.length === 0 ? (
          <p className="text-subtle px-5 py-8 text-center text-sm text-pretty">
            No organisation has been created yet.
          </p>
        ) : (
          <div className="scroll-x-hint">
            <DataTable>
              <Thead>
                <tr>
                  <Th>Organisation</Th>
                  <Th align="right">People</Th>
                  <Th align="right">Drafted</Th>
                  <Th align="right">Submitted</Th>
                  <Th align="right">Approved</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Reconciled</Th>
                  <Th align="right">Last active</Th>
                </tr>
              </Thead>
              <tbody className="divide-y">
                {tenants.map((row) => (
                  <Tr key={row.organization_id}>
                    <Td className="text-[12.5px] font-medium">
                      {row.name}
                      <span className="text-subtle block text-[11px] font-normal">
                        joined {ago(row.created_at, now)}
                      </span>
                    </Td>
                    <Td align="right" className={NUM}>{number(row.members)}</Td>
                    <Td align="right" className={NUM}>{number(row.vouchers_drafted)}</Td>
                    <Td align="right" className={NUM}>{number(row.vouchers_submitted)}</Td>
                    <Td align="right" className={NUM}>{number(row.vouchers_approved)}</Td>
                    <Td align="right" className={NUM}>{number(row.vouchers_paid)}</Td>
                    <Td align="right" className={NUM}>{number(row.reconciliations_saved)}</Td>
                    <Td align="right" className="text-subtle text-[11.5px] whitespace-nowrap">
                      {row.last_event ? ago(row.last_event, now) : 'never'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<UserPlus className="size-4" />}
            title="Signed up and stopped"
            description="Accounts that never joined an organisation. They belong to nobody's tenant by definition, which is why naming them here is fair — and every one is somebody who could usefully be emailed today."
            action={
              onboarding.length > 0 ? (
                <Pill tone="var(--status-warn)">{number(onboarding.length)}</Pill>
              ) : undefined
            }
          />
          {onboarding.length === 0 ? (
            <p className="text-subtle px-5 py-8 text-center text-sm text-pretty">
              Everybody who signed up went on to create or join an organisation.
            </p>
          ) : (
            <DataTable>
              <Thead>
                <tr>
                  <Th>Who</Th>
                  <Th align="right">Signed up</Th>
                </tr>
              </Thead>
              <tbody className="divide-y">
                {onboarding.slice(0, 40).map((row) => (
                  <Tr key={row.email}>
                    <Td>
                      <span className="block text-[12.5px] font-medium">
                        {row.full_name ?? row.email}
                      </span>
                      {row.full_name && (
                        <span className="text-subtle block text-[11px]">{row.email}</span>
                      )}
                    </Td>
                    <Td align="right" className="text-subtle text-[11.5px] whitespace-nowrap">
                      {ago(row.signed_up_at, now)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<CreditCard className="size-4" />}
            title="What the paid lookups cost"
            description="Every enrichment call that was billable, by how it turned out. Recorded since the enrichment work went in and, until now, displayed nowhere."
            action={paidLookups > 0 ? <Pill tone="var(--h-amber)">{number(paidLookups)}</Pill> : undefined}
          />
          <Split
            items={lookupsByOutcome}
            empty="No billable lookup has been made. Apollo is not configured, so the enrichment panel has never spent anything."
          />
          {spend.length > 0 && (
            <div className="border-t px-5 py-4">
              <Fact
                label="Most recent"
                value={ago(spend[0].spent_at, now)}
                says={`${spend[0].kind} · ${spend[0].subject} · requested by ${spend[0].actor_email}`}
              />
            </div>
          )}
        </Card>
      </section>

      <Card>
        <CardTitle
          icon={<CheckCheck className="size-4" />}
          title="Milestones by day"
          description={`Every recorded event over the last ${days} days, with the number of distinct organisations behind each day. This is the one chart here that respects the window.`}
        />
        <div className="px-5 py-4">
          <Trend points={activityByDay(events, days, new Date(now))} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Mail className="size-4" />}
          title="What is not measured here"
          description="Stated rather than left to be discovered, because an absent number on a dashboard reads as a zero."
        />
        <ul className="text-subtle space-y-2.5 px-5 py-4 text-[12px] leading-snug">
          <li>
            <strong className="text-[var(--text-c)]">Anything before the trigger existed.</strong>{' '}
            The six events from migration 0022 start there; the five added in 0026 —
            invite_sent, the three voucher outcomes and reconciliation_saved — start from the day it
            was applied. None of it can be backfilled, so early figures understate the truth.
          </li>
          <li>
            <strong className="text-[var(--text-c)]">Whether the assistant was useful.</strong>{' '}
            Tool opens are counted; answers, refusals and errors are not, so the assistant&rsquo;s
            value is currently unmeasurable.
          </li>
          <li>
            <strong className="text-[var(--text-c)]">Anything about a voucher itself.</strong>{' '}
            No amount, vendor, invoice number or note reaches this page. The functions behind it
            return counts and durations, which is what stops an operator dashboard from becoming a
            window into a customer&rsquo;s payment records.
          </li>
        </ul>
      </Card>
    </div>
  );
}

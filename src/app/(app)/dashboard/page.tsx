import Link from 'next/link';
import { FileText, Inbox, AlertCircle, Wallet, Plus, Activity, GitBranch } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canApprove } from '@/lib/domain/workflow';
import { ageInDays } from '@/lib/utils';
import { fiscalYear, istParts, istToday } from '@/lib/fiscal';
import {
  buttonClass,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
} from '@/components/ui/primitives';
import { Briefing } from '@/components/dashboard/Briefing';
import { StatCard } from '@/components/dashboard/StatCard';
import { VoucherPipeline } from '@/components/dashboard/VoucherPipeline';
import { ActivityStrip } from '@/components/dashboard/ActivityStrip';
import { VoucherTable } from '@/components/voucher/VoucherTable';

export const metadata = { title: 'Dashboard' };

/**
 * How many of this person's own vouchers to load.
 *
 * Everything on this screen except the approval queue is derived from one query,
 * so this number bounds the pipeline, the thirty-day strip and the approved-value
 * card. Two hundred is comfortably more than a month of work for one person, and
 * it is a single indexed read either way.
 */
const OWN_LIMIT = 200;

/** Statuses that mean the money has not finished moving. */
const UNSETTLED = ['draft', 'rejected', 'pending_first', 'pending_second'];

/**
 * The dashboard.
 *
 * Role-aware, and organised around one question: what should this person do next.
 * A member cares about what has been sent back to them; an approver cares about
 * queue depth and how long the head of it has been sitting there. So the briefing
 * at the top picks its own sentence and its own primary button from the data, and
 * the four cards below it differ by role.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const queueQuery = canApprove(user.role)
    ? supabase
        .from('vouchers')
        // Enough to size the queue and to know how long its head has waited.
        .select('grand_total, submitted_at')
        .in('status', ['pending_first', 'pending_second'])
        .is('deleted_at', null)
        // You can never approve your own voucher, so it is not your queue.
        .neq('created_by', user.id)
    : null;

  const [mine, queue] = await Promise.all([
    supabase
      .from('vouchers')
      .select('*')
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(OWN_LIMIT),
    queueQuery ?? Promise.resolve(null),
  ]);

  const rows = mine.data ?? [];
  const queueRows = (queue?.data ?? []) as { grand_total: number; submitted_at: string | null }[];

  const drafts = rows.filter((v) => v.status === 'draft');
  const sentBack = rows.filter((v) => v.status === 'rejected');
  const awaiting = rows.filter((v) => ['pending_first', 'pending_second'].includes(v.status));
  const settled = rows.filter((v) => ['approved', 'paid'].includes(v.status));
  const unsettled = rows.filter((v) => UNSETTLED.includes(v.status));

  const value = (list: { grand_total: string | number }[]) =>
    list.reduce((sum, v) => sum + Number(v.grand_total ?? 0), 0);

  const totalValue = value(rows);
  const settledValue = value(settled);
  const inFlightValue = value(unsettled);

  const pending = queueRows.length;
  const queueValue = value(queueRows);
  // The queue is not ordered here, so find the head of it rather than assume it.
  const oldestWait = queueRows.reduce((max, v) => Math.max(max, ageInDays(v.submitted_at)), 0);

  const { weekday, partOfDay } = istParts();
  const fiscal = fiscalYear(istToday());
  const firstName = user.full_name?.trim().split(/\s+/)[0];

  const cards = [
    ...(canApprove(user.role)
      ? [
          {
            label: 'Waiting on you',
            value: pending,
            hint: pending === 0 ? 'The queue is clear' : `${queueValue > 0 ? 'Worth ' : ''}${pending === 1 ? 'one voucher' : `${pending} vouchers`}`,
            href: '/approvals',
            icon: Inbox,
            tone: 'var(--status-pending)',
            urgent: pending > 0,
          },
        ]
      : []),
    {
      label: 'Sent back to you',
      value: sentBack.length,
      hint: sentBack.length === 0 ? 'Nothing returned' : 'Correct it and resubmit',
      href: '/vouchers?status=rejected',
      icon: AlertCircle,
      tone: 'var(--status-rejected)',
      urgent: sentBack.length > 0,
      share: rows.length ? sentBack.length / rows.length : 0,
    },
    {
      label: 'Your drafts',
      value: drafts.length,
      hint: drafts.length === 0 ? 'None in progress' : 'Finish and submit',
      href: '/vouchers?status=draft',
      icon: FileText,
      tone: 'var(--status-draft)',
      share: rows.length ? drafts.length / rows.length : 0,
    },
    {
      label: 'Approved value',
      value: settledValue,
      kind: 'rupees' as const,
      hint: `${settled.length} voucher${settled.length === 1 ? '' : 's'} cleared`,
      href: '/vouchers?status=approved',
      icon: Wallet,
      tone: 'var(--status-approved)',
      share: totalValue ? settledValue / totalValue : 0,
    },
  ];

  /*
   * The one sentence, and the button under it. Ordered by what a person can
   * actually act on: something sent back to you is blocked on you alone, a queue
   * is blocked on you but shared, your own drafts are blocked on you but not
   * urgent, and anything with an approver is not yours to move at all.
   */
  const brief =
    sentBack.length > 0
      ? {
          lead: `${count(sentBack.length, 'voucher')} came back for correction. That is the only thing here that nobody else can clear for you.`,
          cta: { href: '/vouchers?status=rejected', label: 'See what came back', primary: true },
        }
      : pending > 0
        ? {
            lead:
              oldestWait >= 3
                ? `${count(pending, 'voucher')} ${pending === 1 ? 'is' : 'are'} waiting for your approval, and the oldest has been in the queue ${oldestWait} days.`
                : `${count(pending, 'voucher')} ${pending === 1 ? 'is' : 'are'} waiting for your approval.`,
            cta: { href: '/approvals', label: 'Open the queue', primary: true },
          }
        : awaiting.length > 0
          ? {
              lead: `${count(awaiting.length, 'of your vouchers', 'of your vouchers')} ${awaiting.length === 1 ? 'is' : 'are'} with approvers. Nothing is waiting on you.`,
              cta: { href: '/vouchers?status=pending_first', label: 'See where they are', primary: false },
            }
          : drafts.length > 0
            ? {
                lead: `${count(drafts.length, 'draft')} ${drafts.length === 1 ? 'is' : 'are'} unfinished. Nothing else needs you today.`,
                cta: { href: '/vouchers?status=draft', label: 'Finish your drafts', primary: true },
              }
            : {
                lead: 'Nothing needs your attention. The queue is clear and nothing has come back.',
                cta: { href: '/vouchers/new', label: 'Raise a voucher', primary: true },
              };

  return (
    <div className="space-y-6">
      <Briefing
        greeting={firstName ? `Good ${partOfDay}, ${firstName}.` : `Good ${partOfDay}.`}
        when={`${weekday} ${partOfDay}`}
        lead={brief.lead}
        cta={brief.cta}
        fiscal={fiscal}
        inFlight={{
          value: inFlightValue,
          count: unsettled.length,
          share: totalValue ? inFlightValue / totalValue : 0,
        }}
      />

      <div
        className={
          cards.length === 4
            ? 'stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
            : 'stagger grid gap-3 sm:grid-cols-3'
        }
      >
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 90} />
        ))}
      </div>

      {rows.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr] xl:items-start">
          <Card className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <CardTitle
              icon={<GitBranch className="size-4" />}
              title="Your pipeline"
              description={`Where your ${rows.length === 1 ? 'voucher sits' : `${rows.length} most recent vouchers sit`}.`}
            />
            <CardBody className="py-5">
              <VoucherPipeline rows={rows} />
            </CardBody>
          </Card>

          <Card className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_80ms_backwards]">
            <CardTitle
              icon={<Activity className="size-4" />}
              title="Your last 30 days"
              description="One column per day, weekends on a fainter track."
            />
            <CardBody className="py-5">
              <ActivityStrip rows={rows} today={istToday()} />
            </CardBody>
          </Card>
        </div>
      )}

      <Card className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden">
        <CardTitle
          icon={<FileText className="size-4" />}
          title="Your recent vouchers"
          action={
            <Link
              href="/vouchers"
              className="text-sm font-medium text-brand-600 transition hover:underline dark:text-brand-300"
            >
              View all
            </Link>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="No vouchers yet"
            description="Create your first payment voucher. It stays a private draft until you submit it for approval."
            action={
              <Link href="/vouchers/new" className={buttonClass({ variant: 'primary' })}>
                <Plus className="size-4" aria-hidden />
                New voucher
              </Link>
            }
          />
        ) : (
          <VoucherTable rows={rows.slice(0, 8)} caption="Your eight most recent vouchers." />
        )}
      </Card>
    </div>
  );
}

/** "1 voucher" / "3 vouchers", without the caller assembling it each time. */
function count(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

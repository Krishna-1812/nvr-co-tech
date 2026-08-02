import Link from 'next/link';
import { FileText, Inbox, AlertCircle, Wallet, Plus, Activity } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canApprove } from '@/lib/domain/workflow';
import { fmtRupees, fmtDate } from '@/lib/domain/voucher';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import {
  buttonClass,
  Card,
  CardBody,
  CardTitle,
  DataTable,
  EmptyState,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/primitives';
import { StatCard } from '@/components/dashboard/StatCard';
import { VoucherPipeline } from '@/components/dashboard/VoucherPipeline';

export const metadata = { title: 'Dashboard' };

/**
 * Role-aware dashboard. v1 showed everyone the same two numbers (count and
 * total). What actually matters differs by role: a member cares about what has
 * been sent back to them, an approver about queue depth.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [mine, queue] = await Promise.all([
    supabase
      .from('vouchers')
      .select('*')
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    canApprove(user.role)
      ? supabase
          .from('vouchers')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending_first', 'pending_second'])
          .is('deleted_at', null)
          .neq('created_by', user.id)
      : Promise.resolve({ count: 0 }),
  ]);

  const rows = mine.data ?? [];
  const drafts = rows.filter((v) => v.status === 'draft');
  const sentBack = rows.filter((v) => v.status === 'rejected');
  const awaiting = rows.filter((v) => ['pending_first', 'pending_second'].includes(v.status));
  const settled = rows.filter((v) => ['approved', 'paid'].includes(v.status));
  const settledValue = settled.reduce((s, v) => s + Number(v.grand_total ?? 0), 0);
  const pending = queue.count ?? 0;

  const stats = [
    ...(canApprove(user.role)
      ? [
          {
            label: 'Waiting on you',
            value: String(pending),
            hint: pending === 0 ? 'Queue is clear' : 'Go to the queue',
            href: '/approvals',
            icon: Inbox,
            urgent: pending > 0,
          },
        ]
      : []),
    {
      label: 'Sent back to you',
      value: String(sentBack.length),
      hint: sentBack.length === 0 ? 'Nothing returned' : 'Correct and resubmit',
      href: '/vouchers?status=rejected',
      icon: AlertCircle,
      urgent: sentBack.length > 0,
    },
    {
      label: 'Your drafts',
      value: String(drafts.length),
      hint: drafts.length === 0 ? 'None in progress' : 'Finish and submit',
      href: '/vouchers?status=draft',
      icon: FileText,
    },
    {
      label: 'Approved value',
      value: fmtRupees(settledValue),
      hint: `${settled.length} voucher${settled.length === 1 ? '' : 's'} cleared`,
      href: '/vouchers?status=approved',
      icon: Wallet,
    },
  ];

  const summary =
    sentBack.length > 0
      ? `${sentBack.length} voucher${sentBack.length === 1 ? '' : 's'} need${sentBack.length === 1 ? 's' : ''} your attention.`
      : pending > 0
        ? `${pending} voucher${pending === 1 ? '' : 's'} ${pending === 1 ? 'is' : 'are'} waiting for your approval.`
        : awaiting.length > 0
          ? `${awaiting.length} of your vouchers ${awaiting.length === 1 ? 'is' : 'are'} awaiting approval.`
          : 'Nothing needs your attention right now.';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="NVR Intelligence"
        title={user.full_name ? `Hello, ${user.full_name.split(' ')[0]}` : 'Dashboard'}
        description={summary}
        action={
          <Link href="/vouchers/new" className={buttonClass({ variant: 'primary', className: 'group' })}>
            <Plus className="size-4 transition-transform group-hover:rotate-90" aria-hidden />
            New voucher
          </Link>
        }
      />

      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {rows.length > 0 && (
        <Card className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <CardTitle
            icon={<Activity className="size-4" />}
            title="Your pipeline"
            description={`Where your ${rows.length} most recent voucher${rows.length === 1 ? '' : 's'} sit.`}
          />
          <CardBody>
            <VoucherPipeline rows={rows} />
          </CardBody>
        </Card>
      )}

      <section className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards]">
        <Card className="overflow-hidden">
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
            <DataTable>
              <Thead>
                <tr>
                  <Th>Voucher</Th>
                  <Th className="hidden md:table-cell">Payee</Th>
                  <Th className="hidden md:table-cell">Date</Th>
                  <Th className="hidden sm:table-cell">Status</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </Thead>
              <tbody className="divide-y">
                {rows.slice(0, 8).map((v) => (
                  <Tr key={v.id} className="group">
                    <Td>
                      <Link
                        href={`/vouchers/${v.id}`}
                        className="numeric font-medium transition group-hover:text-brand-600 group-hover:underline dark:group-hover:text-brand-300"
                      >
                        {v.voucher_no ?? 'Draft'}
                      </Link>
                      {/*
                        Payee, date and status have their own columns from md
                        up. Below that they fold under the voucher number rather
                        than pushing the amount off a phone screen.
                      */}
                      <p className="text-subtle mt-0.5 max-w-40 truncate text-xs md:hidden">
                        {[v.paid_to, fmtDate(v.date)].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <div className="mt-1.5 sm:hidden">
                        <StatusBadge status={v.status} size="sm" />
                      </div>
                    </Td>
                    <Td className="text-muted hidden max-w-48 truncate md:table-cell">
                      {v.paid_to ?? '—'}
                    </Td>
                    <Td className="text-muted numeric hidden whitespace-nowrap md:table-cell">
                      {fmtDate(v.date) || '—'}
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <StatusBadge status={v.status} size="sm" />
                    </Td>
                    <Td align="right" className="amount font-semibold whitespace-nowrap">
                      {fmtRupees(v.grand_total)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </section>
    </div>
  );
}

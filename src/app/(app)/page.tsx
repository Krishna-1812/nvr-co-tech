import Link from 'next/link';
import { FileText, Inbox, AlertCircle, Wallet } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canApprove } from '@/lib/domain/workflow';
import { fmtRupees, fmtDate } from '@/lib/domain/voucher';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, EmptyState } from '@/components/ui/primitives';

export const metadata = { title: 'Dashboard · NVR Voucher' };

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

  const stats = [
    ...(canApprove(user.role)
      ? [
          {
            label: 'Waiting on you',
            value: String(queue.count ?? 0),
            href: '/approvals',
            icon: Inbox,
            urgent: (queue.count ?? 0) > 0,
          },
        ]
      : []),
    {
      label: 'Sent back to you',
      value: String(sentBack.length),
      href: '/vouchers?status=rejected',
      icon: AlertCircle,
      urgent: sentBack.length > 0,
    },
    {
      label: 'Your drafts',
      value: String(drafts.length),
      href: '/vouchers?status=draft',
      icon: FileText,
    },
    {
      label: 'Approved value',
      value: fmtRupees(settledValue),
      href: '/vouchers?status=approved',
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {user.full_name ? `Hello, ${user.full_name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="text-muted mt-1 text-sm">
          {sentBack.length > 0
            ? `${sentBack.length} voucher${sentBack.length === 1 ? '' : 's'} need${sentBack.length === 1 ? 's' : ''} your attention.`
            : awaiting.length > 0
              ? `${awaiting.length} of your vouchers ${awaiting.length === 1 ? 'is' : 'are'} awaiting approval.`
              : 'Nothing needs your attention right now.'}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className="p-4 transition group-hover:border-[var(--border-strong)] group-hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-muted text-xs font-medium">{s.label}</span>
                <s.icon
                  className={`size-4 ${s.urgent ? 'text-brand-600' : 'text-[var(--text-subtle)]'}`}
                  aria-hidden
                />
              </div>
              <p className="numeric mt-2 text-2xl font-bold">{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Your recent vouchers</h2>
          <Link href="/vouchers" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>

        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-8" />}
              title="No vouchers yet"
              description="Create your first payment voucher to get started."
              action={
                <Link
                  href="/vouchers/new"
                  className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  New voucher
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="surface-sunken text-subtle text-xs">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Voucher</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Payee</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 8).map((v) => (
                    <tr key={v.id} className="transition hover:bg-[var(--surface-sunken)]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/vouchers/${v.id}`}
                          className="numeric font-medium hover:text-brand-600 hover:underline"
                        >
                          {v.voucher_no ?? 'Draft'}
                        </Link>
                      </td>
                      <td className="text-muted max-w-48 truncate px-4 py-3">{v.paid_to ?? '—'}</td>
                      <td className="text-muted px-4 py-3">{fmtDate(v.date) || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={v.status} size="sm" />
                      </td>
                      <td className="numeric px-4 py-3 text-right font-semibold">
                        {fmtRupees(v.grand_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

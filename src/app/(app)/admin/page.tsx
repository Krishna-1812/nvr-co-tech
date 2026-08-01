import { Users } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { isOwner, type UserRole } from '@/lib/domain/workflow';
import { Card, EmptyState } from '@/components/ui/primitives';
import { UserRow } from './UserRow';

export const metadata = { title: 'People · NVR Voucher' };

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

/**
 * People and their roles.
 *
 * This is the screen that makes the approval workflow usable: without it,
 * promoting someone to approver means hand-editing the database, and nothing
 * can ever be approved.
 */
export default async function AdminPeoplePage() {
  const me = await requireUser();
  const supabase = await createClient();

  const [{ data: users }, { data: counts }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('vouchers').select('created_by').is('deleted_at', null),
  ]);

  const rows = (users ?? []) as AdminUser[];

  // Voucher counts per person, so an admin can see who is actually using this.
  const byUser = new Map<string, number>();
  for (const v of (counts ?? []) as { created_by: string }[]) {
    byUser.set(v.created_by, (byUser.get(v.created_by) ?? 0) + 1);
  }

  const approvers = rows.filter((u) => u.role !== 'member').length;

  return (
    <div className="space-y-4">
      {/*
        Two approvers are the minimum the workflow can function with: the second
        approval must come from a different person than the first, and neither
        may be the person who raised the voucher. Below that, vouchers submit
        but can never clear.
      */}
      {approvers < 3 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            You need at least three people who can approve
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            Every voucher needs two different approvers, and neither can be the person who raised
            it. With {approvers} {approvers === 1 ? 'person' : 'people'} able to approve, some
            vouchers will have nobody left to clear them.
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" />}
            title="No one has signed up yet"
            description="People appear here once they create an account."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="surface-sunken text-subtle text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Person</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Vouchers</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    voucherCount={byUser.get(u.id) ?? 0}
                    isSelf={u.id === me.id}
                    viewerIsOwner={isOwner(me.role)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-subtle text-xs">
        Only an owner can change roles, and never their own or another owner’s.
      </p>
    </div>
  );
}

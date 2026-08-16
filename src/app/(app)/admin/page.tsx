import type { CSSProperties } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { tolerateMissingColumns, withAvatar } from '@/lib/supabase/columns';
import { isOwner, type UserRole } from '@/lib/domain/workflow';
import { Card, CardTitle, DataTable, EmptyState, Th, Thead } from '@/components/ui/primitives';
import { UserRow } from './UserRow';
import { InviteForm } from './InviteForm';
import { ApprovalPolicyCard } from './ApprovalPolicyCard';

export const metadata = { title: 'People' };

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  /** Optional: the select drops it on a database that has not got the column yet. */
  avatar_url?: string | null;
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

  const [{ data: users }, { data: counts }, { data: org }] = await Promise.all([
    tolerateMissingColumns(() =>
      supabase
        .from('profiles')
        .select(withAvatar('id, email, full_name, role, is_active, created_at'))
        .order('created_at', { ascending: true }),
    ),
    supabase.from('vouchers').select('created_by').is('deleted_at', null),
    supabase.from('organizations').select('requires_approval').single(),
  ]);

  const requiresApproval = org?.requires_approval ?? true;

  // The select string is built at runtime (see lib/supabase/columns.ts), so
  // supabase-js has no literal to infer the row from.
  const rows = (users ?? []) as unknown as AdminUser[];

  // Voucher counts per person, so an admin can see who is actually using this.
  const byUser = new Map<string, number>();
  for (const v of (counts ?? []) as { created_by: string }[]) {
    byUser.set(v.created_by, (byUser.get(v.created_by) ?? 0) + 1);
  }

  const approvers = rows.filter((u) => u.role !== 'member').length;

  return (
    <div className="space-y-4">
      <InviteForm />

      {isOwner(me.role) && <ApprovalPolicyCard requiresApproval={requiresApproval} />}

      {/*
        Two approvers are the minimum the workflow can function with: the second
        approval must come from a different person than the first, and neither
        may be the person who raised the voucher. Below that, vouchers submit
        but can never clear. Not a concern once this organization has turned
        approval off entirely — nobody is ever waiting on a second signature.
      */}
      {requiresApproval && approvers < 3 && (
        <div
          role="alert"
          style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
          className="tinted flex gap-3 rounded-xl border p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">You need at least three people who can approve</p>
            <p className="mt-1 text-pretty opacity-90">
              Every voucher needs two different approvers, and neither can be the person who raised
              it. With {approvers} {approvers === 1 ? 'person' : 'people'} able to approve, some
              vouchers will have nobody left to clear them.
            </p>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Users className="size-4" />}
          title="People"
          description={`${rows.length} account${rows.length === 1 ? '' : 's'} · ${approvers} able to approve`}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="No one has signed up yet"
            description="People appear here once they create an account."
          />
        ) : (
          <DataTable>
            <Thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th align="right" className="hidden sm:table-cell">
                  Vouchers
                </Th>
                <Th className="hidden md:table-cell">
                  <span className="sr-only">Why the role is locked</span>
                </Th>
              </tr>
            </Thead>
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
          </DataTable>
        )}
      </Card>

      <p className="text-subtle text-xs">
        Only an owner can change roles, and never their own or another owner’s.
      </p>
    </div>
  );
}

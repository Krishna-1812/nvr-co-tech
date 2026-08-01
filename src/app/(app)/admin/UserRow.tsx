'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setUserRole } from '@/app/actions/admin';
import { ROLE_META, USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { Select } from '@/components/ui/primitives';
import type { AdminUser } from './page';

const ROLE_STYLE: Record<UserRole, string> = {
  member: 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
  approver: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  admin: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  owner: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
};

export function UserRow({
  user,
  voucherCount,
  isSelf,
  viewerIsOwner,
}: {
  user: AdminUser;
  voucherCount: number;
  isSelf: boolean;
  viewerIsOwner: boolean;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [busy, startTransition] = useTransition();

  // Mirrors set_user_role: only an owner may change roles, never their own, and
  // never another owner's. Postgres refuses regardless; this explains why.
  const locked = !viewerIsOwner || isSelf || user.role === 'owner';
  const lockReason = !viewerIsOwner
    ? 'Only an owner can change roles'
    : isSelf
      ? 'You cannot change your own role'
      : user.role === 'owner'
        ? 'An owner’s role cannot be changed'
        : '';

  const change = (next: UserRole) => {
    const previous = role;
    setRole(next); // optimistic
    startTransition(async () => {
      const res = await setUserRole({ userId: user.id, role: next });
      if (res.ok) {
        toast.success(`${user.full_name ?? user.email} is now ${next}.`);
      } else {
        setRole(previous); // roll back
        toast.error(res.error);
      }
    });
  };

  return (
    <tr className="transition hover:bg-[var(--surface-sunken)]">
      <td className="px-4 py-3">
        <p className="font-medium">
          {user.full_name ?? user.email.split('@')[0]}
          {isSelf && <span className="text-subtle ml-1.5 text-xs font-normal">(you)</span>}
        </p>
        <p className="text-subtle truncate text-xs">{user.email}</p>
      </td>

      <td className="px-4 py-3">
        {locked ? (
          <span
            title={lockReason}
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ROLE_STYLE[role]}`}
          >
            {role}
          </span>
        ) : (
          <Select
            value={role}
            disabled={busy}
            onChange={(e) => change(e.target.value as UserRole)}
            aria-label={`Role for ${user.email}`}
            className="w-auto min-w-32"
          >
            {USER_ROLES.filter((r) => r !== 'owner').map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Select>
        )}
        <p className="text-subtle mt-1 text-xs">{ROLE_META[role].grants}</p>
      </td>

      <td className="numeric text-muted px-4 py-3 text-right">{voucherCount || '—'}</td>

      <td className="px-4 py-3">
        {locked && lockReason && <span className="text-subtle text-xs">{lockReason}</span>}
      </td>
    </tr>
  );
}

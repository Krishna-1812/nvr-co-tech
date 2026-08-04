'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { setUserRole } from '@/app/actions/admin';
import { ROLE_META, USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { Avatar } from '@/components/Avatar';
import { Select, Td, Tr } from '@/components/ui/primitives';
import type { AdminUser } from './page';

/** The same token-mixed chips as StatusBadge, so a role reads like a status. */
const ROLE_TONE: Record<UserRole, string> = {
  member: 'var(--status-draft)',
  approver: 'var(--status-approved)',
  admin: 'var(--status-pending)',
  owner: 'var(--color-brand-500)',
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
    <Tr>
      <Td>
        <div className="flex items-center gap-3">
          {/*
            Their picture where there is one, initials where there is not. A column
            of plain names is much harder to find yourself in, and on the screen
            where roles are handed out, knowing you are looking at the right person
            is the whole job.
          */}
          <Avatar
            name={user.full_name}
            email={user.email}
            url={user.avatar_url}
            px={64}
            className="size-8 rounded-full text-[11px]"
          />
          <div className="min-w-0">
            <p className="font-medium">
              {user.full_name ?? user.email.split('@')[0]}
              {isSelf && <span className="text-subtle ml-1.5 text-xs font-normal">(you)</span>}
            </p>
            <p className="text-subtle truncate text-xs">{user.email}</p>
          </div>
        </div>
      </Td>

      <Td>
        {locked ? (
          <span
            title={lockReason}
            style={{ '--tone': ROLE_TONE[role] } as CSSProperties}
            className="tinted inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize"
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
        <p className="text-subtle mt-1 max-w-56 text-xs text-pretty">{ROLE_META[role].grants}</p>
      </Td>

      <Td align="right" className="numeric text-muted hidden sm:table-cell">
        {voucherCount || '—'}
      </Td>

      <Td className="hidden md:table-cell">
        {locked && lockReason && (
          <span className="text-subtle max-w-40 text-xs text-pretty">{lockReason}</span>
        )}
      </Td>
    </Tr>
  );
}

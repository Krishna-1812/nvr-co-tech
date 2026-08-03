import {
  FileText,
  LayoutDashboard,
  Inbox,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { canApprove, isAdmin, type UserRole } from '@/lib/domain/workflow';

/**
 * The one description of where you can go in this app.
 *
 * Four things render this list — the desktop rail, the phone dock, the command
 * palette and the account menu — and before it was shared they had begun to
 * disagree: the palette offered a section the rail did not show, and the dock
 * dropped Admin without saying so. A destination appearing in one place and not
 * another is the kind of bug nobody reports and everybody notices.
 *
 * `hint` is written for the command palette, where a person is reading a list of
 * unfamiliar labels rather than clicking a nav item they already know.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  /** Rendered as a count on the rail and the dock. Only the queue has one. */
  badge?: number;
  /** Kept out of the phone dock, which has room for four things at most. */
  secondary?: boolean;
};

export function appNav({
  role,
  pendingCount = 0,
}: {
  role: UserRole;
  pendingCount?: number;
}): NavItem[] {
  return [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      hint: 'What needs you today',
    },
    {
      href: '/vouchers',
      label: 'Vouchers',
      icon: FileText,
      hint: 'The whole register, searchable',
    },
    ...(canApprove(role)
      ? [
          {
            href: '/approvals',
            label: 'Approvals',
            icon: Inbox,
            hint: 'Vouchers waiting on you',
            badge: pendingCount,
          },
        ]
      : []),
    ...(isAdmin(role)
      ? [
          {
            href: '/admin',
            label: 'Admin',
            icon: Users,
            hint: 'People, chapters and deleted vouchers',
            secondary: true,
          },
        ]
      : []),
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
      hint: 'Your account and appearance',
    },
  ];
}

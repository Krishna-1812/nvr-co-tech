import Link from 'next/link';
import { FileText, LayoutDashboard, Inbox, Settings, Users, Plus } from 'lucide-react';
import { canApprove, isAdmin, type UserRole } from '@/lib/domain/workflow';
import { NavLink } from './NavLink';
import { UserMenu } from './UserMenu';

type Props = {
  user: { id: string; email: string; full_name: string | null; role: UserRole };
  /** Number of vouchers waiting on this person — drives the queue badge. */
  pendingCount?: number;
  children: React.ReactNode;
};

export function AppShell({ user, pendingCount = 0, children }: Props) {
  const nav = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/vouchers', label: 'Vouchers', icon: FileText },
    ...(canApprove(user.role)
      ? [{ href: '/approvals', label: 'Approvals', icon: Inbox, badge: pendingCount }]
      : []),
    ...(isAdmin(user.role) ? [{ href: '/admin', label: 'Admin', icon: Users }] : []),
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-[var(--surface-raised)]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              NVR
            </span>
            <span className="hidden text-sm font-semibold sm:block">N V R &amp; Co</span>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-4 hidden items-center gap-0.5 md:flex">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} badge={item.badge}>
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/vouchers/new"
              className="hidden h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:inline-flex"
            >
              <Plus className="size-4" aria-hidden />
              New voucher
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/*
          Mobile nav lives at the bottom of the header rather than in a hamburger:
          approving on a phone is the common case for this app, so the queue must
          be one tap away.
        */}
        <nav className="flex items-center gap-0.5 overflow-x-auto border-t px-2 py-1.5 md:hidden">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} badge={item.badge}>
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

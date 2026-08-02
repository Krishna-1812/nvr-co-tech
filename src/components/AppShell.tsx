import Link from 'next/link';
import { FileText, LayoutDashboard, Inbox, Settings, Users, Plus, FlaskConical } from 'lucide-react';
import { canApprove, isAdmin, type UserRole } from '@/lib/domain/workflow';
import { PREVIEW } from '@/lib/preview';
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
    <div className="relative min-h-screen">
      {/*
        Page-wide wash. Fixed rather than scrolling, so long tables do not drag a
        gradient up the screen with them.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(70%_50%_at_50%_-10%,var(--color-brand-500),transparent)] opacity-[0.07]"
      />

      {PREVIEW && (
        <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          <span>
            Preview — sample data, no database. Approvals here are checked by the browser, not by
            Postgres.
          </span>
        </div>
      )}

      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="gradient-brand elev-brand grid size-8 place-items-center rounded-lg text-[10px] font-bold tracking-tight text-white transition group-hover:brightness-110">
              NVR
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              N V R &amp; Co
            </span>
          </Link>

          <span aria-hidden className="hidden h-5 w-px bg-[var(--border-c)] md:block" />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
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
              className="gradient-brand elev-brand group hidden h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition hover:brightness-110 active:scale-[0.98] sm:inline-flex"
            >
              <Plus className="size-4 transition-transform group-hover:rotate-90" aria-hidden />
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

      {/* Reachable on a phone, where the header's New voucher button is hidden. */}
      <Link
        href="/vouchers/new"
        aria-label="New voucher"
        className="gradient-brand elev-4 fixed right-5 bottom-5 z-30 grid size-13 place-items-center rounded-2xl text-white transition hover:brightness-110 active:scale-95 sm:hidden"
      >
        <Plus className="size-6" aria-hidden />
      </Link>
    </div>
  );
}

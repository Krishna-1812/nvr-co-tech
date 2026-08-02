import Link from 'next/link';
import { FileText, LayoutDashboard, Inbox, Settings, Users, Plus, FlaskConical } from 'lucide-react';
import { canApprove, isAdmin, type UserRole } from '@/lib/domain/workflow';
import { PREVIEW } from '@/lib/preview';
import { BRAND } from '@/lib/marketing/content';
import { LogoMark } from './marketing/Logo';
import { buttonClass } from './ui/primitives';
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
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
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

      {/* First stop for a keyboard user, past a nav that repeats on every page. */}
      <a
        href="#main"
        className="gradient-brand elev-brand sr-only rounded-lg px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

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
          {/*
            The same mark as the public site. Someone who signed in from the
            marketing pages should not feel handed off to a different product,
            and "Voucher Desk" is what this app is now called out there.
          */}
          <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
            <LogoMark id="app-mark" className="size-8 shrink-0 transition group-hover:brightness-110" />
            <span className="hidden leading-none sm:block">
              <span className="block text-sm font-semibold tracking-tight">Voucher Desk</span>
              <span className="text-subtle mt-0.5 block text-[10px]">{BRAND.name}</span>
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
              className={buttonClass({
                variant: 'primary',
                size: 'sm',
                className: 'group hidden sm:inline-flex',
              })}
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
        <nav
          aria-label="Sections"
          className="flex snap-x snap-mandatory items-center gap-0.5 overflow-x-auto border-t px-2 py-1.5 md:hidden"
        >
          {nav.map((item) => (
            <div key={item.href} className="shrink-0 snap-start">
              <NavLink href={item.href} badge={item.badge}>
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </NavLink>
            </div>
          ))}
        </nav>
      </header>

      {/*
        pb-24 on small screens keeps the last row of any list clear of the
        floating New voucher button.
      */}
      <main id="main" className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 sm:pt-8 sm:pb-12">
        {children}
      </main>

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

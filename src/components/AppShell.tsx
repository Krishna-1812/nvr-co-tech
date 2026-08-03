import type { UserRole } from '@/lib/domain/workflow';
import { appNav } from '@/lib/nav';
import { fiscalYear, istLongDate, istToday } from '@/lib/fiscal';
import { PREVIEW } from '@/lib/preview';
import { Backdrop } from './app/Backdrop';
import { SideRail } from './app/SideRail';
import { TopBar } from './app/TopBar';
import { MobileDock } from './app/MobileDock';
import { PreviewBanner } from './app/PreviewBanner';

type Props = {
  user: { id: string; email: string; full_name: string | null; role: UserRole };
  /** Number of vouchers waiting on this person — drives the queue badge. */
  pendingCount?: number;
  children: React.ReactNode;
};

/**
 * The frame every signed-in screen sits in.
 *
 * Three pieces of chrome and one atmosphere: a rail on the left from `lg` up, a
 * dock along the bottom below it, a glass bar across the top at every width, and
 * the Backdrop behind all of them.
 *
 * The rail's width is a CSS variable rather than a prop, which is what lets the
 * content column follow it when it collapses without either of them holding
 * state. See RailToggle for why that matters.
 */
export function AppShell({ user, pendingCount = 0, children }: Props) {
  const nav = appNav({ role: user.role, pendingCount });
  const fiscal = fiscalYear(istToday());

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      {/* First stop for a keyboard user, past a nav that repeats on every page. */}
      <a
        href="#main"
        className="gradient-brand elev-brand sr-only rounded-lg px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <SideRail nav={nav} fiscal={fiscal} />

      {/*
        The content column. `pl` tracks the rail through the same variable the
        rail's own width uses, and transitions on the same curve, so the two move
        as one object rather than as two things that happen to agree.
      */}
      <div className="transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:pl-[var(--a-rail)]">
        {PREVIEW && <PreviewBanner />}

        <TopBar user={user} fiscal={fiscal} today={istLongDate()} />

        {/*
          The bottom padding clears the dock. Nothing at the end of a long
          register should end up hidden behind chrome.
        */}
        <main
          id="main"
          className="mx-auto max-w-[92rem] px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:pb-14"
        >
          {children}
        </main>
      </div>

      <MobileDock nav={nav} />
    </div>
  );
}

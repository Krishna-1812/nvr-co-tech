import type { UserRole } from '@/lib/domain/workflow';
import type { Section } from '@/lib/nav';
import { fiscalYear, istLongDate, istToday } from '@/lib/fiscal';
import { PREVIEW } from '@/lib/preview';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { Backdrop } from './app/Backdrop';
import { SideRail } from './app/SideRail';
import { TopBar } from './app/TopBar';
import { MobileDock } from './app/MobileDock';
import { PreviewBanner } from './app/PreviewBanner';
import { Toasts } from './app/Toasts';
import { ThemeColor } from './app/ThemeColor';
import { RouteStage } from './app/RouteStage';
import { Play } from './marketing/play/Play';
import { ChatDock } from './chat/ChatDock';
import { AGENTS } from '@/lib/marketing/content';
import { OPEN_TOOLS } from '@/lib/access';

type Props = {
  /** Null for a visitor using the open workspace without an account. */
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    /** Their Google picture, if they signed in with Google. Passed to UserMenu. */
    avatarUrl?: string | null;
  } | null;
  /** Whether this person is a platform admin (lib/access). Shown in the account menu. */
  admin?: boolean;
  /** Which tool you are inside. Decides the rail, the dock and the palette. */
  section: Section;
  children: React.ReactNode;
};

/**
 * The frame every signed-in tool sits in.
 *
 * Three pieces of chrome and one atmosphere: a rail on the left from `lg` up, a
 * dock along the bottom below it, a glass bar across the top at every width, and
 * the Backdrop behind all of them.
 *
 * What the frame does NOT know is which tool it is holding. That arrives as a
 * Section, so a second tool is a nav definition and a route group rather than a
 * second shell to keep in step with this one.
 *
 * The rail's width is a CSS variable rather than a prop, which is what lets the
 * content column follow it when it collapses without either of them holding
 * state. See RailToggle for why that matters.
 */
export async function AppShell({ user, admin = false, section: given, children }: Props) {
  // A visitor has no account to set, so the rail does not offer one.
  const section = user ? given : { ...given, items: given.items.filter((i) => i.href !== '/settings') };
  const fiscal = fiscalYear(istToday());

  /*
   * Whether to offer the way in to the Admin screen.
   *
   * Asked here, once, rather than in each tool's layout, because the account
   * menu is the only chrome every shell shares and this is the flag that
   * decides what it shows. It resolves to the same Postgres function the
   * row-level policies call, so the door cannot appear for somebody the
   * database would then hand nothing to — and cannot stay hidden from somebody
   * it would.
   *
   * Memoised per request, so on the analytics screens themselves — where the
   * layout has already asked — this costs nothing.
   */
  const analyticsAdmin = user ? await isAnalyticsAdmin() : false;

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      {/* First stop for a keyboard user, past a nav that repeats on every page. */}
      <a
        href="#main"
        className="gradient-brand elev-brand sr-only rounded-lg px-4 py-2 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <SideRail section={section} fiscal={fiscal} />

      {/*
        The content column. `pl` tracks the rail through the same variable the
        rail's own width uses, and transitions on the same curve, so the two move
        as one object rather than as two things that happen to agree.
      */}
      <div className="transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:pl-[var(--a-rail)]">
        {PREVIEW && <PreviewBanner />}

        <TopBar
          user={user}
          section={section}
          fiscal={fiscal}
          today={istLongDate()}
          analyticsAdmin={analyticsAdmin}
          admin={admin}
        />

        {/*
          The bottom padding clears the dock. Nothing at the end of a long
          register should end up hidden behind chrome.
        */}
        <main
          id="main"
          className="mx-auto max-w-[92rem] px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:pb-14"
        >
          {/* The transition between screens: a curtain into another tool, a
              rise within this one. See RouteStage. */}
          <RouteStage room={section.home}>{children}</RouteStage>
        </main>
      </div>

      <MobileDock nav={section.items} />

      <ThemeColor />

      {/* One place for the whole signed-in side, and never on the public site. */}
      <Toasts />

      {/*
        The chat in the corner. Signed in, it is the assistant that knows the
        tool on screen and keeps a history; a visitor in the open workspace
        gets the public chat, which keeps nothing. Not on /ask, which is it.
      */}
      <ChatDock
        mode={user ? 'member' : 'visitor'}
        skin="app"
        placement="app"
        agent={AGENTS.some((a) => a.slug === section.slug) ? section.slug : null}
        agentName={AGENTS.some((a) => a.slug === section.slug) ? section.name : null}
        firstName={user?.full_name?.trim().split(/\s+/)[0] || null}
        open={OPEN_TOOLS}
      />

      {/* The public site's delegated motion, pointed at the app's own targets:
          buttons that flood from the pointer, labels marked data-decode, and
          confetti only where data-celebrate marks a real moment of success. */}
      <Play decode="[data-decode]" throwOn="[data-celebrate]" spotlight=".surface-lit" />
    </div>
  );
}

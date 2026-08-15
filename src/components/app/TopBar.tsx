import Link from 'next/link';
import type { UserRole } from '@/lib/domain/workflow';
import type { Fiscal } from '@/lib/fiscal';
import { ASSIST_SLUG, type Section } from '@/lib/nav';
import { UserMenu } from '../UserMenu';
import { buttonClass } from '../ui/primitives';
import { AssistPanel } from '../assist/AssistPanel';
import { CommandPalette } from './CommandPalette';
import { HomeCrumb } from './HomeCrumb';

/**
 * The bar across the top of every signed-in screen.
 *
 * It carries four things: where you are and the way up out of it (the
 * breadcrumb), the way in to everything (⌘K) and the way out (the account menu).
 *
 * Below `lg` the rail is gone, so the tool's primary action moves in here, since
 * the rail is normally holding it. The breadcrumb does not move, because it is
 * the only thing on the screen naming the level above this one.
 */
export function TopBar({
  user,
  section,
  fiscal,
  today,
  analyticsAdmin = false,
}: {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    /** Their Google picture, if they signed in with Google. Passed to UserMenu. */
    avatarUrl?: string | null;
  };
  section: Section;
  fiscal: Fiscal;
  today: string;
  /** Decided once in AppShell, from the same function the RLS policies call. */
  analyticsAdmin?: boolean;
}) {
  const Primary = section.primary?.icon;

  return (
    <header className="a-glass sticky top-0 z-30 border-b">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/*
          At every width, not just where the rail is missing. A tool is something
          you are inside, and the bar should say so and offer the way out whether
          or not the rail happens to be on screen.
        */}
        <HomeCrumb section={section} />

        {/* The slug rather than the section: the palette is a client component,
            and a Section carries Lucide icons, which are functions and cannot
            cross that boundary. It rebuilds the section from the slug. */}
        <CommandPalette sectionSlug={section.slug} role={user.role} />

        {/*
          Today's date and the financial year, both in Asia/Kolkata. On a phone
          the rail's fiscal meter is not on screen, so this is the only place the
          year appears — and the year is what all of this work is filed under.
        */}
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <span className="text-subtle numeric text-xs">{today}</span>
          <span aria-hidden className="h-4 w-px bg-[var(--border-c)]" />
          <span className="a-label" title={`${fiscal.daysLeft} days left in this financial year`}>
            FY {fiscal.label}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          {/*
            The assistant follows you into whichever tool you are in, and is told
            which one that is. Not offered on its own page, where the whole screen
            is already it.
          */}
          {section.slug !== ASSIST_SLUG && (
            <AssistPanel agent={section.slug} agentName={section.name} />
          )}

          {/* Only where the rail is not there to carry it. The same button twice
              on one screen is one too many. */}
          {section.primary && Primary && (
            <Link
              href={section.primary.href}
              aria-label={section.primary.label}
              className={buttonClass({
                variant: 'primary',
                size: 'sm',
                className: 'group h-9 px-2.5 sm:px-3.5 lg:hidden',
              })}
            >
              <Primary className="size-4 transition-transform group-hover:rotate-90" aria-hidden />
              <span className="hidden sm:inline">{section.primary.short}</span>
            </Link>
          )}
          <UserMenu user={user} analyticsAdmin={analyticsAdmin} />
        </div>
      </div>
    </header>
  );
}

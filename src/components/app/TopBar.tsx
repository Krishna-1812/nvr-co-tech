import Link from 'next/link';
import type { UserRole } from '@/lib/domain/workflow';
import type { Fiscal } from '@/lib/fiscal';
import type { Section } from '@/lib/nav';
import { BRAND } from '@/lib/marketing/content';
import { LogoMark } from '../marketing/Logo';
import { UserMenu } from '../UserMenu';
import { buttonClass } from '../ui/primitives';
import { CommandPalette } from './CommandPalette';

/**
 * The bar across the top of every signed-in screen.
 *
 * It carries almost nothing, on purpose. The rail already says where you are and
 * where you can go, so this is left with the two things that belong at the top of
 * a window: the way in to everything (⌘K) and the way out (the account menu).
 *
 * Below `lg` the rail is gone, so the tool's name moves in here — otherwise the
 * app would have no name on a phone — and so does its primary action, which the
 * rail is normally holding.
 */
export function TopBar({
  user,
  section,
  fiscal,
  today,
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
}) {
  const Primary = section.primary?.icon;

  return (
    <header className="a-glass sticky top-0 z-30 border-b">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Link href={section.home} className="group flex shrink-0 items-center gap-2.5 lg:hidden">
          <LogoMark
            id="bar-mark"
            className="size-8 shrink-0 transition group-hover:brightness-110"
          />
          <span className="hidden leading-none sm:block">
            <span className="block text-[13.5px] font-semibold tracking-tight">{section.name}</span>
            <span className="text-subtle mt-1 block text-[10px]">{BRAND.name}</span>
          </span>
        </Link>

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
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

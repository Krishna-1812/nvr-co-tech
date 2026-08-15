import {
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  Plus,
  Scale,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { canApprove, isAdmin, type UserRole } from '@/lib/domain/workflow';

/**
 * Where you can go, per tool.
 *
 * Four things render this — the desktop rail, the phone dock, the command
 * palette and the account menu — and before it was shared they had begun to
 * disagree: the palette offered a section the rail did not show, and the dock
 * dropped Admin without saying so. A destination appearing in one place and not
 * another is the kind of bug nobody reports and everybody notices.
 *
 * It is a Section rather than a flat list because the platform now runs more
 * than one tool, and each one has its own destinations, its own name in the rail
 * and its own primary action. Voucher Desk's "New voucher" button means nothing
 * inside a reconciliation, and a rail that offered it would be advertising the
 * wrong tool. What the two share is the shell they sit in, which is exactly what
 * this type describes.
 *
 * `hint` is written for the command palette, where somebody is reading a list of
 * unfamiliar labels rather than clicking a nav item they already know.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  /** Rendered as a count on the rail and the dock. Only a queue has one. */
  badge?: number;
  /** Kept out of the phone dock, which has room for four things at most. */
  secondary?: boolean;
};

export type Section = {
  /** The tool's slug in the roster, so a screen can find its own accent. */
  slug: string;
  /** What the rail calls it, under the platform mark. */
  name: string;
  /** Where the mark goes: this tool's own front door. */
  home: string;
  /** The one control that should not have to compete for space. */
  primary?: { href: string; label: string; icon: LucideIcon; short: string };
  items: NavItem[];
};

export function voucherSection({
  role,
  pendingCount = 0,
}: {
  role: UserRole;
  pendingCount?: number;
}): Section {
  return {
    slug: 'voucher-desk',
    name: 'Voucher Desk',
    home: '/dashboard',
    primary: { href: '/vouchers/new', label: 'New voucher', icon: Plus, short: 'New' },
    items: [
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
    ],
  };
}

/**
 * The assistant is not on the roster, and this slug is what says so.
 *
 * AGENTS is the list of tools we sell, and the assistant is not one of them: it
 * is a way of asking about the others. Giving it a slug that cannot collide with
 * a roster entry keeps that distinction enforceable, and lets the shell tell
 * "which tool am I in" apart from "am I in the assistant", which is the question
 * the top bar asks before deciding whether to offer the Ask button.
 */
export const ASSIST_SLUG = 'assistant';

/**
 * A section from its slug alone.
 *
 * The command palette needs this. It is a client component, and a Section holds
 * Lucide icons, which are functions — and a function cannot be handed across the
 * server/client boundary. So the palette is given the slug, which is a string,
 * and rebuilds the section on its own side.
 */
export function sectionFor(
  slug: string,
  { role, pendingCount = 0 }: { role: UserRole; pendingCount?: number },
): Section {
  if (slug === 'ledger-reconciliation') return reconSection();
  if (slug === ASSIST_SLUG) return assistSection();
  return voucherSection({ role, pendingCount });
}

/**
 * The assistant with a whole screen to itself.
 *
 * The panel is the main way in and is on every other screen. This exists for the
 * conversation that turned out to be long, and for anyone who would rather have
 * a page they can leave open. No primary action: the primary action is the box
 * at the bottom, which is already the largest thing on the page.
 */
export function assistSection(): Section {
  return {
    slug: ASSIST_SLUG,
    name: 'Ask',
    home: '/ask',
    items: [
      {
        href: '/ask',
        label: 'Ask',
        icon: Sparkles,
        hint: 'Questions about the tools and the accounting',
      },
      {
        href: '/ask/history',
        label: 'History',
        icon: History,
        hint: 'Conversations you have had, and the switch to delete them',
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        hint: 'Your account and appearance',
      },
    ],
  };
}

/**
 * Ledger Reconciliation.
 *
 * No role branch, unlike Voucher Desk. Nothing here is approved or paid, so
 * there is nothing an approver can do that a member cannot, and inventing a
 * permission to make the two tools look alike would only be inventing a way to
 * lock somebody out of their own work.
 */
export function reconSection(): Section {
  return {
    slug: 'ledger-reconciliation',
    name: 'Ledger Reconciliation',
    home: '/reconcile',
    primary: {
      href: '/reconcile',
      label: 'New reconciliation',
      icon: Plus,
      short: 'New',
    },
    items: [
      {
        href: '/reconcile',
        label: 'Reconcile',
        icon: Scale,
        hint: 'Match two ledgers and get the statement',
      },
      {
        href: '/reconcile/history',
        label: 'History',
        icon: History,
        hint: 'Reconciliations you have saved',
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        hint: 'Your account and appearance',
      },
    ],
  };
}

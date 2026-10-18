import {
  Activity,
  Building,
  FileText,
  History,
  Inbox,
  Layers,
  LayoutDashboard,
  Plus,
  Scale,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Users,
  Wallet,
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
  /**
   * Match this path only, not its subtree.
   *
   * Needed wherever one destination's href is a prefix of another's — `/admin`
   * under `/admin/chapters`, `/contacts` under `/contacts/activity`. Without it
   * the parent stays lit inside its own child and the rail shows two current
   * pages. It lives here rather than in the rail because which hrefs nest is a
   * fact about the section, and the rail and the dock were each keeping their
   * own half-complete list of them.
   */
  exact?: boolean;
  /**
   * What the phone dock calls it, when the full label does not fit a cell.
   *
   * A dock cell is a sixth of a phone at worst, about 61px. "Organisations"
   * needs 68 and spilled into its neighbours; "Access requests" was the only
   * label in the bar that wrapped to two lines. Both now have a short form,
   * and the rail and the palette go on using the full one.
   */
  short?: string;
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
              exact: true,
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

/** Your account. One destination, and the way back to the tools is the platform mark. */
export function accountSection(): Section {
  return {
    slug: 'account',
    name: 'Your account',
    home: '/settings',
    items: [{ href: '/settings', label: 'Settings', icon: Settings, hint: 'Your account and appearance', exact: true }],
  };
}

/**
 * The rail for a tool this person may not use (lib/access).
 *
 * One destination, the tool's own front door, because every screen under a
 * locked tool shows the same thing: what the tool does and the request for it.
 * Offering its Vouchers or History would be offering five doors to one room.
 */
export function lockedSection(slug: string, name: string, home: string, icon: LucideIcon): Section {
  return {
    slug,
    name,
    home,
    items: [
      { href: home, label: 'About this tool', icon, hint: 'What it does, and the request for access', exact: true },
      { href: '/settings', label: 'Settings', icon: Settings, hint: 'Your account and appearance' },
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
  if (slug === LANDED_SLUG) return landedSection();
  if (slug === WEALTH_SLUG) return wealthSection();
  if (slug === ASSIST_SLUG) return assistSection();
  if (slug === ANALYTICS_SLUG) return analyticsSection();
  if (slug === FINDER_SLUG) return finderSection();
  return voucherSection({ role, pendingCount });
}

/**
 * Not on the roster either, and for a sharper reason than the assistant.
 *
 * The Admin screen is not something we sell; it is something we run about the
 * people who use what we sell. Since 18 Oct 2026 it is one screen (the owner
 * asked for the many analytics screens to become one simple one). It is also the only part of this platform
 * gated on a list that has nothing to do with anybody's role in the voucher
 * workflow — an owner who can approve a payment sees none of it unless their
 * address is in `analytics_admins`. Giving it a slug outside AGENTS keeps that
 * separation structural rather than remembered.
 */
export const ANALYTICS_SLUG = 'analytics';

export function analyticsSection(): Section {
  return {
    slug: ANALYTICS_SLUG,
    name: 'Admin',
    home: '/analytics',
    items: [
      {
        href: '/analytics',
        label: 'Admin',
        icon: Activity,
        hint: 'Who visited, who signed in, the time each spent, and every request',
        exact: true,
      },
      {
        href: '/analytics/settings',
        label: 'Admin settings',
        short: 'Settings',
        icon: SlidersHorizontal,
        hint: 'Admins, tool access for people, how the figures are counted, and the visit data',
      },
    ],
  };
}

/**
 * Off the roster too, and gated on the same short list as Visitor Intelligence.
 *
 * Contact Finder searches a third party's contact database, and every search
 * that describes a company draws down a credit pool this platform funds with one
 * key — not a budget any tenant holds. So the question "may this person spend
 * it" has nothing to do with their role in anybody's voucher workflow, which is
 * exactly the distinction `analytics_admins` already draws. Reusing that list
 * rather than inventing a second one keeps there being one answer to "who may
 * spend platform money", and means adding a colleague stays a single INSERT.
 *
 * It is also not on AGENTS, and that is a claim about the product rather than a
 * permission: the roster is what The Finance Intelligence sells to chartered
 * accountants, and a B2B prospecting tool is not one of those things. Listing it
 * there would make the public site advertise something we do not offer.
 */
export const FINDER_SLUG = 'contact-finder';

/**
 * Contact Finder.
 *
 * Two things: the tool, and everything the tool has already done. Activity holds
 * what was looked up, what was kept and what it cost — three views of the same
 * spending, which is the one thing about this tool worth a screen of its own.
 *
 * Those three used to be drawers over the search screen, on the reasoning that a
 * result set here is expensive: the rows on screen cost credits to describe and
 * cannot be rebuilt from a URL, so navigating away from them would be a button
 * that throws away money. That is still true, and it is why reopening an entry
 * from Activity returns to /contacts carrying the stored rows rather than
 * running the search again. With the way back free, the drawer was working
 * around a cost that is no longer there.
 */
export function finderSection(): Section {
  return {
    slug: FINDER_SLUG,
    name: 'Contact Finder',
    home: '/contacts',
    items: [
      {
        href: '/contacts',
        label: 'Search',
        icon: Search,
        hint: 'Find people and companies by role, seniority, industry or size',
        // /contacts/activity lives under this href; without `exact` the rail
        // lights Search while you are standing on Activity.
        exact: true,
      },
      {
        href: '/contacts/activity',
        label: 'Activity',
        icon: Activity,
        hint: 'Searches you have run, the rows you kept, and what the credits went on',
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
        exact: true,
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
 * True Property Cost.
 *
 * One destination, because the tool is one screen: the schedules it keeps are
 * picked from that screen rather than from a list page of their own, and they
 * live in the browser, so there is no server-side history to give a page to.
 * No role branch, for the same reason as Ledger Reconciliation below.
 */
/**
 * Wealth Tracker.
 *
 * One destination, like True Property Cost: the record is a single screen with
 * its own tabs, and it lives in the browser, so there is no server-side list of
 * anything to give a page of its own. No role branch: a person's own record has
 * no approver.
 */
export const WEALTH_SLUG = 'wealth-tracker';

export function wealthSection(): Section {
  return {
    slug: WEALTH_SLUG,
    name: 'Wealth Tracker',
    home: '/wealth-tracker',
    items: [
      {
        href: '/wealth-tracker',
        label: 'My record',
        icon: Wallet,
        hint: 'Assets, liabilities, nominees and net worth',
        exact: true,
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

export const LANDED_SLUG = 'true-property-cost';

export function landedSection(): Section {
  return {
    slug: LANDED_SLUG,
    name: 'True Property Cost',
    home: '/true-property-cost',
    items: [
      {
        href: '/true-property-cost',
        label: 'Calculator',
        icon: Building,
        hint: 'Instalments, cost of funds and the cost at possession',
        exact: true,
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
/**
 * Valuation Desk.
 *
 * `Comparables` has no role branch, like Ledger Reconciliation and unlike
 * Voucher Desk: a peer set is not approved or paid, so there is nothing an
 * approver can do here that a member cannot, and inventing a permission to
 * make the tools look alike would only be inventing a way to lock somebody out
 * of their own work.
 *
 * `Comparables` is the home rather than a list of saved peer sets, because the
 * first thing anybody wants is the table — the history is what you go back to
 * afterwards, and leading with it would mean an empty screen on day one.
 *
 * `Seed the registry` does NOT branch on `role` the way `/admin` does in
 * Voucher Desk — a tenant's own admin is not the right gate. It writes into
 * the *shared* registry every tenant on the platform reads, so the list that
 * decides who sees it has to be the platform-wide one (`analytics_admins`,
 * via `isAnalyticsAdmin()`), not "admin of your own organisation". Every
 * customer's admin/owner would otherwise clear `isAdmin(role)`, which is
 * exactly the bug this replaced: the link (and the page and action behind
 * it) were visible to any tenant's admin, not just the two platform
 * operators.
 */
export function valuationSection({ canSeed }: { canSeed: boolean }): Section {
  return {
    slug: 'valuation-desk',
    name: 'Valuation Desk',
    home: '/comps',
    items: [
      {
        href: '/comps',
        label: 'Comparables',
        icon: Layers,
        hint: 'Peer companies, their multiples, and what they imply',
        exact: true,
      },
      ...(canSeed
        ? [
            {
              href: '/comps/ingest',
              label: 'Seed the registry',
              icon: UploadCloud,
              hint: 'Pull real companies from a source, so there is something to compare',
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
        exact: true,
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

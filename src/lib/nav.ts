import {
  Activity,
  AlertTriangle,
  Building2,
  FileText,
  History,
  Inbox,
  Layers,
  LayoutDashboard,
  Plus,
  Radar,
  Scale,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  UploadCloud,
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
  if (slug === ANALYTICS_SLUG) return analyticsSection();
  if (slug === FINDER_SLUG) return finderSection();
  return voucherSection({ role, pendingCount });
}

/**
 * Not on the roster either, and for a sharper reason than the assistant.
 *
 * Visitor intelligence is not something we sell; it is something we run about
 * the people who look at what we sell. It is also the only part of this platform
 * gated on a list that has nothing to do with anybody's role in the voucher
 * workflow — an owner who can approve a payment sees none of it unless their
 * address is in `analytics_admins`. Giving it a slug outside AGENTS keeps that
 * separation structural rather than remembered.
 */
export const ANALYTICS_SLUG = 'analytics';

export function analyticsSection(): Section {
  return {
    slug: ANALYTICS_SLUG,
    name: 'Visitor Intelligence',
    home: '/analytics',
    items: [
      {
        href: '/analytics',
        label: 'Overview',
        icon: Activity,
        hint: 'Traffic, where it came from and how the site is holding up',
      },
      /*
       * Second, and deliberately ahead of everything about the public site. This
       * is the only screen in the section that answers whether the product
       * works; the rest answer who looked at the marketing for it. When the two
       * competed for the top of the rail the traffic screens won for two years,
       * and the activation data sat in a table nothing read.
       */
      {
        href: '/analytics/activation',
        label: 'Activation',
        icon: TrendingUp,
        hint: 'Signups, workspaces, first vouchers, and where the workflow stalls',
      },
      {
        href: '/analytics/external',
        label: 'Usage',
        icon: Users,
        hint: 'Everyone signed in, customers or our own team',
      },
      {
        href: '/analytics/orgs',
        label: 'Organisations',
        short: 'Orgs',
        icon: Building2,
        hint: 'Per tenant: people, vouchers, and whether they have ever finished one',
      },
      {
        href: '/analytics/requests',
        label: 'Access requests',
        short: 'Access',
        icon: Inbox,
        hint: 'Who has asked to be let in, and what for',
      },
      /*
       * The public site, last of the substantive four and deliberately so.
       *
       * It was two screens and near the top. It is one screen and near the
       * bottom, because most of what made it feel important was a company column
       * that was inventing its answers — and because at this traffic the question
       * it answers is the least commercially urgent one in the section.
       */
      {
        href: '/analytics/visitors',
        label: 'Public site',
        icon: Radar,
        hint: 'Anonymous sessions, the lead funnel, and how the marketing pages are read',
        secondary: true,
      },
      {
        href: '/analytics/errors',
        label: 'Errors',
        icon: AlertTriangle,
        hint: 'Every failure a page boundary or a route handler caught',
        secondary: true,
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
 * Two items, and the working list and the history are deliberately not among
 * them. Both are drawers over the search screen rather than destinations,
 * because a result set here is expensive: the rows on screen may have cost
 * credits to describe and cannot be rebuilt from the URL, so a rail item that
 * navigated away from them would be a button that throws away money. A drawer
 * lets you check what you have collected without losing what you are collecting.
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

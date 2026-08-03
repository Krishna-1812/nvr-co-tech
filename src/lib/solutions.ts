import {
  GitCompareArrows,
  Landmark,
  MessagesSquare,
  Percent,
  ReceiptIndianRupee,
  ScanText,
  type LucideIcon,
} from 'lucide-react';
import { AGENTS, type Agent, type AgentStage } from '@/lib/marketing/content';

/**
 * The roster, as the signed-in hub needs it.
 *
 * The list itself is not redefined here. `AGENTS` in lib/marketing/content is the
 * one place a tool's name, stage, category and promise are written down, and the
 * hub reads from it for the same reason the public site does: a tool that goes
 * live has to change stage in one file, not in two, or the workspace will still be
 * offering to put someone on a waiting list for something they already have.
 *
 * What is added here is the part that only makes sense once you are signed in: a
 * mark for each tool, a colour that works in the app's two themes rather than the
 * marketing skin's one, and where the thing actually opens.
 */

/**
 * A mark per tool.
 *
 * Kept out of the content module deliberately — that file is imported by the
 * public pages and by metadata generation, and a Lucide icon is a React component,
 * which is the sort of thing that has no business in a file of strings.
 */
const ICON: Record<string, LucideIcon> = {
  'voucher-desk': ReceiptIndianRupee,
  'ledger-reconciliation': GitCompareArrows,
  'gst-reconciliation': Percent,
  'tds-compliance': Landmark,
  'invoice-intake': ScanText,
  'audit-copilot': MessagesSquare,
};

/**
 * The agent's accent, as an app token.
 *
 * `agent.accent` names a colour; the two skins disagree about what that colour is
 * worth. The marketing site's --m-* values are tuned for one dark ground and are
 * scoped so nothing in the app can reach them, so the hub reads --h-* instead.
 */
export const ACCENT_VAR: Record<Agent['accent'], string> = {
  indigo: 'var(--h-indigo)',
  violet: 'var(--h-violet)',
  cyan: 'var(--h-cyan)',
  emerald: 'var(--h-emerald)',
  amber: 'var(--h-amber)',
  rose: 'var(--h-rose)',
  lime: 'var(--h-lime)',
  magenta: 'var(--h-magenta)',
};

/**
 * What each stage is worth, in the app's own status colours.
 *
 * Reusing --status-* rather than inventing a third vocabulary: on every other
 * screen in this app green means done, amber means in hand and grey means not
 * started, and a tool being live or not is the same idea one level up.
 */
export const STAGE_TONE: Record<AgentStage, string> = {
  live: 'var(--status-approved)',
  building: 'var(--status-warn)',
  planned: 'var(--status-draft)',
};

/** What the card's footer says about a stage, written for someone already inside. */
export const STAGE_NOTE: Record<AgentStage, string> = {
  live: 'Ready to use',
  building: 'Being built now',
  planned: 'Not started yet',
};

export type Solution = Agent & {
  icon: LucideIcon;
  /** CSS colour for this tool's accent, correct in both themes. */
  tone: string;
  /** Where it opens in the app. Only set for a tool you can actually use. */
  open?: string;
  /** Its page on the public site, where the plan for it is written down. */
  plan: string;
};

/**
 * The roster in reading order: what you can use, then what is being built, then
 * what is written down. `AGENTS` is already in that order and the hub does not
 * re-sort it, because the order is an editorial decision and it belongs with the
 * content.
 */
export const SOLUTIONS: Solution[] = AGENTS.map((agent) => ({
  ...agent,
  icon: ICON[agent.slug] ?? ReceiptIndianRupee,
  tone: ACCENT_VAR[agent.accent],
  // `agent.href` is the deep link the public site uses for the live tool. Reused
  // rather than repeated, so there is still one answer to "where does this open".
  open: agent.stage === 'live' ? agent.href : undefined,
  plan: `/agents/${agent.slug}`,
}));

/** How many tools are at each stage. The hub states this above the grid. */
export function stageCounts(): { live: number; building: number; planned: number } {
  return {
    live: SOLUTIONS.filter((s) => s.stage === 'live').length,
    building: SOLUTIONS.filter((s) => s.stage === 'building').length,
    planned: SOLUTIONS.filter((s) => s.stage === 'planned').length,
  };
}

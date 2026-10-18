/**
 * Who may use which tool.
 *
 * Since 18 October 2026 the workspace is open: anybody can walk in without an
 * account, see every live tool, and use two of them. Signing in adds one thing,
 * which is somewhere to keep your work (see lib/cloud). It does not open any
 * more tools. The other four are open to the platform's admins and to nobody
 * else; everybody else is shown the tool and asked whether they want access,
 * and that ask is recorded for us to answer (actions/access.ts).
 *
 * ── Why these two ──────────────────────────────────────────────────────────
 * True Property Cost and Wealth Tracker run entirely in the browser. They read
 * no shared table, spend no platform money and need no organisation, so a
 * visitor with no account can use them in full. The four that stay locked all
 * reach a server for their substance: Voucher Desk is a firm's approval
 * workflow, Ledger Reconciliation keeps a history in Postgres, Valuation Desk
 * reads the shared company registry (and its brief spends model credits), and
 * Contact Finder spends the platform's Apollo credits.
 *
 * ── Why the admin list is here and not only in Postgres ────────────────────
 * The analytics allowlist (`analytics_admins`, lib/analytics/admin) has always
 * been the one list of platform people, and it still counts: anybody on it is
 * an admin here too, so adding a colleague remains one INSERT with no deploy.
 * The addresses below are the ones the owner named when the workspace opened.
 * They are written into the code as well so that they work from the moment
 * this deploys, rather than from the moment somebody remembers to paste the
 * matching SQL; Contact Finder still needs them in the table, because its
 * routes and its caches are guarded by `is_analytics_admin()` inside Postgres.
 * Migration 0032 puts them there.
 *
 * The address compared is the one Supabase verified at sign-in (Google's, or
 * a confirmed email), never anything the browser sends.
 */

/** The platform's admins, as the owner listed them. Compared in lower case. */
export const ADMIN_EMAILS: readonly string[] = [
  'vivekgaggar@yahoo.com',
  'triptigaggar@yahoo.com',
  'vivek.gaggar@nvrandco.com',
  'ladhakrishna2022@gmail.com',
  'team@thefinanceintelligence.com',
];

/** The tools anybody may use, signed in or not. */
export const OPEN_TOOLS: readonly string[] = ['true-property-cost', 'wealth-tracker'];

/** The live tools that only an admin may use. Everybody else may ask. */
export const LOCKED_TOOLS: readonly string[] = [
  'voucher-desk',
  'ledger-reconciliation',
  'valuation-desk',
  'contact-finder',
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(e);
}

/** Whether somebody with this standing may use a tool. Unknown slugs are no. */
export function canUseTool(slug: string, admin: boolean): boolean {
  if (OPEN_TOOLS.includes(slug)) return true;
  return admin && LOCKED_TOOLS.includes(slug);
}

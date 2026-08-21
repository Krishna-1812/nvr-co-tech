import { createClient } from '@/lib/supabase/server';
import type {
  Firmographics,
  PageViewRow,
  PaidFirmographics,
  Resolution,
  VisitorIdentityRow,
  VisitorViewRow,
} from './types';
import type {
  OperatorMemberRow,
  OperatorOnboardingRow,
  OperatorStuckRow,
  OperatorTenantRow,
  OperatorWorkflowStageRow,
  ProductEventRow,
} from '@/lib/supabase/types';
import type { RunEvent } from './people';

/**
 * Everything that touches the database.
 *
 * Two halves with completely different rules, and keeping them in one file is
 * what makes the difference visible.
 *
 * The writes are called from unauthenticated endpoints, so they go through the
 * SECURITY DEFINER functions in migration 0010 rather than inserting directly:
 * no event table has an insert policy, which means the publishable key in the
 * browser bundle cannot be used to write a single row. Every one of them also
 * swallows its own failure. A tracker that can make a page fail is worse than
 * no tracker, and a storage outage should cost a row of analytics, not a
 * visitor.
 *
 * The reads are called only from the analytics screens, which is to say only
 * while somebody on the allowlist is looking at them, and RLS is what enforces
 * that rather than anything in this file.
 */

// ─── Writing ─────────────────────────────────────────────────────────────────

/** The three writers, named so a typo cannot become a silently dropped beacon. */
type Writer = 'record_visitor_view' | 'record_page_view' | 'record_identity';

async function fireAndForget(fn: Writer, payload: Record<string, unknown>): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc(fn, { p: payload });
  } catch {
    // Deliberately silent. See the note above: nothing about analytics is worth
    // a visitor seeing an error, and the endpoints all answer ok regardless.
  }
}

export const recordVisitorView = (row: Record<string, unknown>) =>
  fireAndForget('record_visitor_view', row);

export const recordPageView = (row: Record<string, unknown>) =>
  fireAndForget('record_page_view', row);

export const recordIdentity = (row: Record<string, unknown>) =>
  fireAndForget('record_identity', row);

// ─── Reading ─────────────────────────────────────────────────────────────────

/**
 * Enough rows to answer a month's questions, and a ceiling so that one busy
 * week cannot turn the dashboard into a table scan.
 */
const ROW_LIMIT = 20_000;

export async function readVisitorViews(days = 30): Promise<VisitorViewRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = await createClient();
  const { data } = await supabase
    .from('visitor_analytics')
    .select('*')
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false })
    .limit(ROW_LIMIT);

  return (data ?? []) as unknown as VisitorViewRow[];
}

export async function readVisitorViewsFor(visitorId: string): Promise<VisitorViewRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('visitor_analytics')
    .select('*')
    .eq('visitor_id', visitorId)
    .order('occurred_at', { ascending: false })
    .limit(500);

  return (data ?? []) as unknown as VisitorViewRow[];
}

export async function readSignedInViews(days = 30): Promise<PageViewRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = await createClient();
  const { data } = await supabase
    .from('page_views')
    .select('*')
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false })
    .limit(ROW_LIMIT);

  return (data ?? []) as unknown as PageViewRow[];
}

export async function readIdentities(): Promise<VisitorIdentityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('visitor_identities')
    .select('*')
    .order('identified_at', { ascending: false })
    .limit(2_000);

  return (data ?? []) as unknown as VisitorIdentityRow[];
}

/**
 * The staff allowlist, as a list rather than a yes/no.
 *
 * `analyticsGate()` answers "am I allowed in". This answers "who counts as one
 * of us", which is what splits the internal usage page from the external one.
 * Both read the same table, so a person added to the allowlist moves from the
 * customer view to the staff view on the next page load, with nothing else to
 * update — which is the whole reason the split is defined by this table and not
 * by an email domain.
 */
export async function readStaffEmails(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('analytics_admins').select('email');

  return (data ?? [])
    .map((row) => (row as { email: string | null }).email)
    .filter((email): email is string => Boolean(email))
    .map((email) => email.trim().toLowerCase());
}

/**
 * Names and photographs.
 *
 * The page-view log stores an address and nothing else, on purpose — it is
 * written on every page load and has no business carrying a display name that
 * would then go stale. So the roster joins this on afterwards.
 */
export async function readProfileDirectory(): Promise<
  {
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    organization_name: string | null;
  }[]
> {
  const members = await readOperatorMembers();
  return members.map((m) => ({
    email: m.email,
    full_name: m.full_name,
    avatar_url: m.avatar_url,
    organization_name: m.organization_name,
  }));
}

/**
 * Every tenant, and who belongs to which.
 *
 * ── Why this no longer reads the tables ─────────────────────────────────────
 *
 * It used to select straight from `organizations` and `profiles`, and it
 * therefore returned exactly one organisation — the caller's own — however many
 * tenants existed. `organizations_read` is `using (id = my_organization_id())`
 * and `profiles_read_self` is scoped the same way, so an operator asking for
 * the tenant list got their own row back and every screen built on this
 * rendered it as though that were the whole platform. Nothing failed; the answer
 * was just quietly wrong, which is the worst kind.
 *
 * It now goes through the operator functions from 0026, which check the
 * analytics allowlist themselves and return counts rather than table rows. The
 * activation figures come back with it, because they are free once the function
 * has been called and because a tenant list ranked by page views was ranking
 * customers by how much marketing they had read.
 *
 * The page-view log still has no tenant column and should not gain one: it is
 * written on every navigation by people who may not belong to an organisation
 * yet, and a column that is null for half its rows is worse than a join. So
 * membership stays a lookup and the attribution happens in the aggregation.
 *
 * The consequence worth knowing: activity is attributed to whichever
 * organisation somebody belongs to *now*, not the one they belonged to when the
 * page view happened. Nobody in this product has ever moved between tenants —
 * `accept_invite` refuses anybody who already belongs to one — so today the two
 * are the same thing. If moving is ever allowed, this becomes a real distinction
 * and the log will not be able to answer it retrospectively.
 */
export async function readTenants(): Promise<{
  organizations: { id: string; name: string; created_at: string }[];
  members: { email: string; organization_id: string | null; full_name: string | null; avatar_url: string | null }[];
  /** The activation counts for each organisation, keyed by id. */
  counts: Map<string, OperatorTenantRow>;
}> {
  const [tenants, members] = await Promise.all([readOperatorTenants(), readOperatorMembers()]);

  return {
    organizations: tenants.map((t) => ({
      id: t.organization_id,
      name: t.name,
      created_at: t.created_at,
    })),
    members: members.map((m) => ({
      email: m.email,
      organization_id: m.organization_id,
      full_name: m.full_name,
      avatar_url: m.avatar_url,
    })),
    counts: new Map(tenants.map((t) => [t.organization_id, t])),
  };
}

/** Opens of metered tools. The window matches whatever the page is showing. */
export async function readAgentRuns(days = 30): Promise<RunEvent[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_runs')
    .select('email, feature_slug, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);

  return data ?? [];
}

/**
 * Every run there has ever been, for one person or for everyone.
 *
 * Separate from `readAgentRuns` because the cap is lifetime, not windowed:
 * "seven of your ten" has to count every run ever made, or somebody's allowance
 * would quietly reset whenever the dashboard's date filter moved.
 */
export async function readAllAgentRuns(): Promise<RunEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_runs')
    .select('email, feature_slug, created_at')
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);

  return data ?? [];
}

// ─── The activation funnel ───────────────────────────────────────────────────

/**
 * Every milestone the database has recorded about itself.
 *
 * Unwindowed on purpose, and it is the one reader here that is. The funnel asks
 * how many organisations have *ever* got as far as submitting a voucher, and a
 * thirty-day window would answer a different question — it would report a
 * tenant that onboarded in June and is working happily today as never having
 * activated, because their organisation_created event is outside the window.
 * Activation is cumulative. Only the trend line is windowed, and it does its own
 * filtering from this same list.
 */
export async function readProductEvents(): Promise<ProductEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('product_events')
    .select('id, name, actor_id, organization_id, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);

  return data ?? [];
}

// ─── The operator's cross-tenant view ────────────────────────────────────────

/**
 * The five functions from migration 0026, and the reason they exist.
 *
 * `readTenants` and `readProfileDirectory` above read `organizations` and
 * `profiles` directly, which sounds right and is almost useless: RLS scopes both
 * to the caller's own organisation, so an operator gets exactly one tenant back
 * however many have signed up. These go through SECURITY DEFINER functions that
 * check the analytics allowlist themselves and return aggregates.
 *
 * Each returns an empty array on failure rather than throwing. An operator
 * screen with one section missing is a better outcome than a section boundary
 * swallowing the whole page, and there is nothing a caller could usefully do
 * with the error that the empty state does not already say.
 */
export async function readOperatorTenants(): Promise<OperatorTenantRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('operator_tenants');
  return data ?? [];
}

export async function readOperatorMembers(): Promise<OperatorMemberRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('operator_members');
  return data ?? [];
}

export async function readOperatorOnboarding(): Promise<OperatorOnboardingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('operator_onboarding');
  return data ?? [];
}

export async function readWorkflowStages(): Promise<OperatorWorkflowStageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('operator_workflow_stages');
  return data ?? [];
}

/** Work that has stopped moving. The threshold is a parameter because seven days
 *  is a guess, and the screen should be able to argue with it. */
export async function readStuckVouchers(days = 7): Promise<OperatorStuckRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('operator_stuck_vouchers', { p_days: days });
  return data ?? [];
}

// ─── The caches ──────────────────────────────────────────────────────────────

/**
 * Version-stamped, and that is the part that matters.
 *
 * A cache keyed only by address and time serves whatever the logic produced on
 * the day it ran, for as long as the TTL lasts — so improving the
 * classification would leave last month's wrong answers in place for a week.
 * Stamping the version means a change to the code invalidates exactly the rows
 * that change affects, on their next read, with nothing to remember to purge.
 *
 * Negative results are cached too, at a much shorter life. A site that was down
 * for a minute should not be written off for a week.
 */
export async function readCachedResolution(ip: string, version: number): Promise<Resolution | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('ip_resolutions')
      .select('resolution, version, expires_at')
      .eq('ip', ip)
      .maybeSingle();

    const row = data as { resolution: unknown; version: number; expires_at: string } | null;
    if (!row || row.version !== version || new Date(row.expires_at) < new Date()) return null;

    return row.resolution as Resolution;
  } catch {
    return null;
  }
}

export async function writeCachedResolution(
  ip: string,
  version: number,
  resolution: Resolution,
  ttlSeconds: number,
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('ip_resolutions').upsert(
      {
        ip,
        version,
        resolution: resolution as unknown as Record<string, unknown>,
        resolved_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlSeconds * 1_000).toISOString(),
      },
      { onConflict: 'ip' },
    );
  } catch {
    // A cache that cannot be written is a slow dashboard, not a broken one.
  }
}

type Tier = 'free' | 'paid';

export async function readCachedCompany<T>(
  domain: string,
  tier: Tier,
  version: number,
): Promise<{ hit: true; data: T | null } | { hit: false }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('company_enrichment')
      .select('data, version, expires_at')
      .eq('domain', domain)
      .eq('tier', tier)
      .maybeSingle();

    const row = data as { data: unknown; version: number; expires_at: string } | null;
    if (!row || row.version !== version || new Date(row.expires_at) < new Date()) return { hit: false };

    // A stored null is a real answer — "we looked, there was nothing" — and it
    // is the whole reason this returns a hit flag rather than just the value.
    return { hit: true, data: (row.data ?? null) as T | null };
  } catch {
    return { hit: false };
  }
}

export async function writeCachedCompany(
  domain: string,
  tier: Tier,
  version: number,
  data: Firmographics | PaidFirmographics | null,
  ttlSeconds: number,
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('company_enrichment').upsert(
      {
        domain,
        tier,
        version,
        data: data as unknown as Record<string, unknown> | null,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlSeconds * 1_000).toISOString(),
      },
      { onConflict: 'domain,tier' },
    );
  } catch {
    // As above.
  }
}

/**
 * A line in the ledger for every paid lookup.
 *
 * The rule is that money is only ever spent because one person clicked one
 * button about one account. A rule nobody can audit afterwards is a rule that
 * quietly stops being true, so each call writes down who caused it and what
 * came back.
 */
export async function recordSpend(entry: {
  actorEmail: string;
  kind: 'company' | 'person';
  subject: string;
  outcome: 'hit' | 'miss' | 'error';
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('enrichment_spend').insert({
      actor_email: entry.actorEmail,
      kind: entry.kind,
      subject: entry.subject,
      outcome: entry.outcome,
    });
  } catch {
    // Nothing to do about it, and it must not break the button.
  }
}

export async function readSpend(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('enrichment_spend')
    .select('*')
    .order('spent_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as {
    id: number;
    spent_at: string;
    actor_email: string;
    kind: string;
    subject: string;
    outcome: string;
  }[];
}

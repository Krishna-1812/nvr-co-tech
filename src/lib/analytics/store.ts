import { createClient } from '@/lib/supabase/server';
import type {
  Firmographics,
  PageViewRow,
  PaidFirmographics,
  Resolution,
  VisitorIdentityRow,
  VisitorViewRow,
} from './types';

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

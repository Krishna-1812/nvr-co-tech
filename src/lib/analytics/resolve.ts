import type { Firmographics, IntentScore, Resolution } from './types';
import { RESOLUTION_TTL_SECONDS, RESOLVER_VERSION, resolveIp } from './ip';
import {
  ENRICH_VERSION,
  NEGATIVE_TTL_SECONDS,
  POSITIVE_TTL_SECONDS,
  enrichCompanyFree,
} from './enrich/free';
import { scoreIntent } from './intent';
import {
  readCachedCompany,
  readCachedResolution,
  writeCachedCompany,
  writeCachedResolution,
} from './store';
import type { VisitorSummary } from './aggregate';
import { PREVIEW } from '@/lib/preview';
import { previewCompany, previewResolution } from '@/lib/preview/resolutions';

/**
 * resolveVisitor — the one orchestrating call, and the one that never spends
 * money.
 *
 * This is safe to run for every visitor on every dashboard load, and it has to
 * be, because that is exactly what the visitor list does. It combines the three
 * free things: which organisation the address belongs to, what that
 * organisation publishes about itself, and how close the visitor's reading
 * looks to a buying decision.
 *
 * The paid path is deliberately not reachable from here. Not by a flag, not by
 * an option — there is simply no import. See enrich/paid.ts.
 */

export type VisitorRecord = {
  summary: VisitorSummary;
  resolution: Resolution | null;
  company: Firmographics | null;
  intent: IntentScore;
};

/**
 * One address, resolved once and remembered.
 *
 * The cache is in Postgres rather than in memory because a serverless function
 * is a fresh process more often than not, and an in-process map would be cold
 * on almost every dashboard load — which is the one moment it is needed.
 */
async function resolveCached(ip: string | null): Promise<Resolution | null> {
  if (!ip) return null;

  /*
   * Preview mode has no database to cache into and no real address to resolve —
   * every sample address is in a documentation range. Running the engine would
   * mean waiting on DNS and a registry to be told, correctly, that nobody is
   * there, and every account screen would then be empty, which shows nothing
   * about how those screens look with something on them.
   */
  if (PREVIEW) return previewResolution(ip);

  const cached = await readCachedResolution(ip, RESOLVER_VERSION);
  if (cached) return cached;

  const fresh = await resolveIp(ip);
  await writeCachedResolution(ip, RESOLVER_VERSION, fresh, RESOLUTION_TTL_SECONDS);
  return fresh;
}

async function enrichCached(domain: string | null): Promise<Firmographics | null> {
  if (!domain) return null;
  if (PREVIEW) return previewCompany(domain);

  const cached = await readCachedCompany<Firmographics>(domain, 'free', ENRICH_VERSION);
  if (cached.hit) return cached.data;

  const fresh = await enrichCompanyFree(domain);
  await writeCachedCompany(
    domain,
    'free',
    ENRICH_VERSION,
    fresh,
    // A dead site or a bad minute must not poison the cache for a week.
    fresh ? POSITIVE_TTL_SECONDS : NEGATIVE_TTL_SECONDS,
  );
  return fresh;
}

export async function resolveVisitor(summary: VisitorSummary): Promise<VisitorRecord> {
  const resolution = await resolveCached(summary.ip);

  // Enrichment follows identification, never precedes it. Fetching a homepage
  // for an address that turned out to be a broadband customer would be a
  // request made about somebody who was never identified.
  const company = resolution?.identified ? await enrichCached(resolution.domain) : null;

  return {
    summary,
    resolution,
    company,
    intent: scoreIntent({
      pages: summary.pages,
      sessions: summary.sessions,
      engagedSeconds: summary.engagedSeconds,
    }),
  };
}

/**
 * A whole list of visitors, without resolving one address twice.
 *
 * Hundreds of rows share a few dozen distinct addresses, and each fresh
 * resolution is up to three network calls. Resolving per row would make the
 * page's load time a function of how much traffic there was, which is precisely
 * backwards.
 */
export async function resolveVisitors(summaries: VisitorSummary[]): Promise<VisitorRecord[]> {
  const cache = new Map<string, Promise<Resolution | null>>();

  const resolutions = await Promise.all(
    summaries.map((s) => {
      if (!s.ip) return Promise.resolve(null);
      const existing = cache.get(s.ip);
      if (existing) return existing;

      const pending = resolveCached(s.ip);
      cache.set(s.ip, pending);
      return pending;
    }),
  );

  // Same again one level down: several visitors from one company share a domain.
  const domains = new Map<string, Promise<Firmographics | null>>();
  const companies = await Promise.all(
    resolutions.map((r) => {
      const domain = r?.identified ? r.domain : null;
      if (!domain) return Promise.resolve(null);

      const existing = domains.get(domain);
      if (existing) return existing;

      const pending = enrichCached(domain);
      domains.set(domain, pending);
      return pending;
    }),
  );

  return summaries.map((summary, index) => ({
    summary,
    resolution: resolutions[index],
    company: companies[index],
    intent: scoreIntent({
      pages: summary.pages,
      sessions: summary.sessions,
      engagedSeconds: summary.engagedSeconds,
    }),
  }));
}

/**
 * One account: every visitor that resolved to the same company, folded together.
 *
 * This is the view that makes the whole system worth building. A single
 * anonymous session is a curiosity; four sessions from one company over a
 * fortnight, two of them on the pricing page, is a reason to pick up a phone.
 */
export type Account = {
  domain: string;
  name: string;
  company: Firmographics | null;
  resolution: Resolution;
  visitors: VisitorRecord[];
  views: number;
  sessions: number;
  engagedSeconds: number;
  lastSeen: string;
  intent: IntentScore;
};

export function groupIntoAccounts(records: VisitorRecord[]): Account[] {
  const byDomain = new Map<string, VisitorRecord[]>();

  for (const record of records) {
    const domain = record.resolution?.identified ? record.resolution.domain : null;
    if (!domain) continue;
    (byDomain.get(domain) ?? byDomain.set(domain, []).get(domain)!).push(record);
  }

  const accounts = [...byDomain].map(([domain, visitors]) => {
    const first = visitors[0];
    const pages = visitors.flatMap((v) => v.summary.pages);
    const sessions = visitors.reduce((sum, v) => sum + v.summary.sessions, 0);
    const engagedSeconds = visitors.reduce((sum, v) => sum + v.summary.engagedSeconds, 0);

    return {
      domain,
      name: first.company?.name ?? first.resolution?.companyName ?? domain,
      company: first.company,
      resolution: first.resolution!,
      visitors,
      views: visitors.reduce((sum, v) => sum + v.summary.views, 0),
      sessions,
      engagedSeconds,
      lastSeen: visitors
        .map((v) => v.summary.lastSeen)
        .sort()
        .at(-1)!,
      // Scored across everybody from the company rather than per person: it is
      // the account that buys, and three colleagues reading three different
      // pages is a stronger signal than any one of them alone.
      intent: scoreIntent({ pages, sessions, engagedSeconds }),
    };
  });

  return accounts.sort((a, b) => b.intent.score - a.intent.score || b.views - a.views);
}

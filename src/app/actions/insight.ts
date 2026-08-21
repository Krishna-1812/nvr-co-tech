'use server';

import { z } from 'zod';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { aiConfigured, orderPeople, readPersonCached, type PersonFacts, type Read } from '@/lib/analytics/ai';
import { matchPerson, paidEnrichmentConfigured } from '@/lib/analytics/enrich/paid';
import { enrichCompanyFree } from '@/lib/analytics/enrich/free';
import { domainOf, isPersonalEmail } from '@/lib/analytics/identity';
import type { PersonMatch } from '@/lib/analytics/types';

/**
 * What the customer usage screen asks the server for after it has rendered.
 *
 * Server actions rather than API routes, because the session travels with them:
 * every function here can call `isAnalyticsAdmin()` and get a real answer with
 * no header parsing and no second auth path to keep in step with the first. The
 * gate is repeated in each one deliberately — a shared wrapper would be tidier
 * and would also mean a new action could be added without one.
 *
 * All three cost money at a provider, so all three refuse anybody not on the
 * allowlist before doing anything else.
 */

/** The shape the browser is allowed to send back. Nothing wider reaches a prompt. */
const factsSchema = z.object({
  email: z.string().email(),
  company: z.string().nullable(),
  visits: z.number().int().min(0),
  pageViews: z.number().int().min(0),
  seconds: z.number().min(0),
  features: z.array(z.string()).max(20),
  runs: z.number().int().min(0),
  preSignupPages: z.number().int().min(0),
  firstSeen: z.string(),
  lastSeen: z.string(),
});

export type EnrichedPerson = {
  /**
   * Which of the four states this person is in. The screen says something
   * different for each, because "no data" covers four situations that need four
   * different things done about them — and one of them is a broken API key.
   */
  status: 'matched' | 'company-only' | 'personal-email' | 'no-match' | 'not-configured';
  person: PersonMatch | null;
  company: { domain: string; name: string | null; description: string | null } | null;
};

/**
 * Enrichment for a batch of people, in one call.
 *
 * Prefetched for everybody visible as soon as the table has rendered, so opening
 * a profile is instant instead of starting a network request on click. Cached
 * underneath at three levels by the modules this calls, so a second look at the
 * same person costs nothing.
 */
export async function enrichPeople(
  emails: string[],
): Promise<Record<string, EnrichedPerson>> {
  if (!(await isAnalyticsAdmin())) return {};

  const configured = paidEnrichmentConfigured();
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 100);

  const results = await Promise.all(
    wanted.map(async (email): Promise<[string, EnrichedPerson]> => {
      if (!configured) {
        return [email, { status: 'not-configured', person: null, company: null }];
      }

      // A personal address has no employer to look up, and spending a paid
      // lookup to discover that gmail.com is not a company would be the same
      // mistake twice.
      if (isPersonalEmail(email)) {
        return [email, { status: 'personal-email', person: null, company: null }];
      }

      const match = await matchPerson({ email });
      if (match) {
        return [email, { status: 'matched', person: match, company: null }];
      }

      // No person on file, so fall back to what their domain says about where
      // they work. Worth having: "somebody at this company" is still a lead.
      const domain = domainOf(email);
      const company = domain ? await enrichCompanyFree(domain) : null;

      return [
        email,
        company
          ? {
              status: 'company-only',
              person: null,
              company: { domain, name: company.name, description: company.description },
            }
          : { status: 'no-match', person: null, company: null },
      ];
    }),
  );

  return Object.fromEntries(results);
}

/** One person's model-written read. Cache first; a call only on a miss. */
export async function summarisePerson(
  facts: unknown,
  days: number,
): Promise<{ ok: true; read: Read } | { ok: false; reason: 'not-allowed' | 'not-configured' | 'failed' }> {
  if (!(await isAnalyticsAdmin())) return { ok: false, reason: 'not-allowed' };
  if (!aiConfigured()) return { ok: false, reason: 'not-configured' };

  const parsed = factsSchema.safeParse(facts);
  if (!parsed.success) return { ok: false, reason: 'failed' };

  const read = await readPersonCached(parsed.data as PersonFacts, days);
  return read ? { ok: true, read } : { ok: false, reason: 'failed' };
}

/**
 * The model's ordering of the visible people.
 *
 * Returns addresses, never rows. The browser reorders what it already holds, so
 * the worst a wrong answer can do is put the table in a silly order — it cannot
 * put somebody on screen who is not in the data.
 */
export async function sortPeopleByAi(
  facts: unknown,
): Promise<{ ok: true; order: string[] } | { ok: false; reason: 'not-allowed' | 'not-configured' | 'failed' }> {
  if (!(await isAnalyticsAdmin())) return { ok: false, reason: 'not-allowed' };
  if (!aiConfigured()) return { ok: false, reason: 'not-configured' };

  const parsed = z.array(factsSchema).max(200).safeParse(facts);
  if (!parsed.success) return { ok: false, reason: 'failed' };

  const order = await orderPeople(parsed.data as PersonFacts[]);
  return order ? { ok: true, order } : { ok: false, reason: 'failed' };
}

/**
 * Is the enrichment provider actually answering?
 *
 * Surfaced behind a button in the profile panel's empty state, for the moment
 * somebody is looking at a person with no data and cannot tell whether the
 * provider has nothing on them or the key has stopped working. Probes with a
 * public example address, never a real person's, so running the diagnostic
 * cannot leak a customer to the provider or spend a lookup on one.
 */
export async function checkEnrichment(): Promise<{
  configured: boolean;
  answering: boolean;
  detail: string;
}> {
  if (!(await isAnalyticsAdmin())) {
    return { configured: false, answering: false, detail: 'Not allowed.' };
  }

  if (!paidEnrichmentConfigured()) {
    return {
      configured: false,
      answering: false,
      detail: 'No APOLLO_API_KEY is set on this deployment, so no enrichment is attempted at all.',
    };
  }

  const probe = await matchPerson({ email: 'example@apollo.io' });

  return probe
    ? { configured: true, answering: true, detail: 'The key works and the provider answered.' }
    : {
        configured: true,
        answering: false,
        detail:
          'A key is set, but the provider returned nothing for a known test address. That usually means the key is rejected or out of credits rather than that your people are missing.',
      };
}

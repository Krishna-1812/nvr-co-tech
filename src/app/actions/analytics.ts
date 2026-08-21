'use server';

import { getCurrentUser } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import {
  PAID_NEGATIVE_TTL_SECONDS,
  PAID_TTL_SECONDS,
  PAID_VERSION,
  deepenCompany,
  paidEnrichmentConfigured,
} from '@/lib/analytics/enrich/paid';
import { readCachedCompany, recordSpend, writeCachedCompany } from '@/lib/analytics/store';
import type { PaidFirmographics } from '@/lib/analytics/types';

/**
 * The only place in this codebase that spends money.
 *
 * There is exactly one call site for `deepenCompany`, it is this action, and
 * this action is only ever reached by somebody pressing a button about one
 * named company. That is not a convention to be remembered — it is the reason
 * the paid module was given its own file with nothing importing it, and the
 * reason the free resolution path has no way to reach it even by accident.
 *
 * Three guards, in order of what they protect:
 *
 *   1. The allowlist, because this is a paid action and a signed-in stranger
 *      must not be able to run up a bill.
 *   2. The cache, because the second click on the same company inside a week
 *      should cost nothing. Firmographics do not change daily.
 *   3. The ledger, because a rule about deliberate spending is only true if
 *      somebody can check it afterwards. Every call writes down who caused it.
 */

export type EnrichResult =
  | { ok: true; data: PaidFirmographics | null; cached: boolean; message: string }
  | { ok: false; message: string };

export async function enrichAccount(domain: string): Promise<EnrichResult> {
  const clean = domain.trim().toLowerCase();
  if (!clean || !clean.includes('.')) {
    return { ok: false, message: 'That is not a domain.' };
  }

  if (!(await isAnalyticsAdmin())) {
    return { ok: false, message: 'You are not able to do that.' };
  }

  if (!paidEnrichmentConfigured()) {
    return {
      ok: false,
      message:
        'No enrichment provider is configured. Set APOLLO_API_KEY and this button starts working; '
        + 'everything else on this screen already does, and costs nothing.',
    };
  }

  const cached = await readCachedCompany<PaidFirmographics>(clean, 'paid', PAID_VERSION);
  if (cached.hit) {
    return {
      ok: true,
      data: cached.data,
      cached: true,
      message: cached.data
        ? 'Already bought within the last week, so this cost nothing.'
        : 'Looked up recently and the provider had nothing. No credit spent.',
    };
  }

  const user = await getCurrentUser();
  const actorEmail = user?.authEmail ?? user?.email ?? 'unknown';

  let data: PaidFirmographics | null = null;
  let outcome: 'hit' | 'miss' | 'error' = 'miss';

  try {
    data = await deepenCompany(clean);
    outcome = data ? 'hit' : 'miss';
  } catch {
    outcome = 'error';
  }

  await recordSpend({ actorEmail, kind: 'company', subject: clean, outcome });

  if (outcome === 'error') {
    return { ok: false, message: 'The provider did not answer. Nothing was cached, so try again.' };
  }

  await writeCachedCompany(
    clean,
    'paid',
    PAID_VERSION,
    data,
    // A miss gets a short life so a transient empty answer does not block a
    // legitimate retry for a week.
    data ? PAID_TTL_SECONDS : PAID_NEGATIVE_TTL_SECONDS,
  );

  return {
    ok: true,
    data,
    cached: false,
    message: data
      ? 'Spent one credit.'
      : 'Spent one credit and the provider had nothing on this company.',
  };
}

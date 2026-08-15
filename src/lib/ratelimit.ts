import { createClient } from '@/lib/supabase/server';

/**
 * A ceiling shared by every serverless instance, for the endpoints an
 * anonymous caller can reach directly.
 *
 * The assistant has its own limiter (src/lib/assist/ratelimit.ts) and keeps
 * it: it counts in memory on purpose, because the thing it exists to stop —
 * one signed-in account's stuck retry loop — is exactly what a per-instance
 * counter sees perfectly, and a database write on every question would be a
 * poor trade for that. This one is for the opposite case: endpoints with no
 * session to key on, where the real ceiling has to hold across however many
 * instances happen to be warm, which means counting in Postgres via
 * check_rate_limit (see migration 0011).
 *
 * Fails open. A rate limiter that can turn "the database had a slow moment"
 * into "every visitor got refused" has made the outage worse, not better —
 * see 0011's own comment: this is a cost control, not a security control.
 */
export type RateVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateVerdict> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; retry_after_seconds: number }
      | undefined;

    if (error || !row) return { allowed: true };

    return row.allowed
      ? { allowed: true }
      : { allowed: false, retryAfterSeconds: row.retry_after_seconds };
  } catch {
    return { allowed: true };
  }
}

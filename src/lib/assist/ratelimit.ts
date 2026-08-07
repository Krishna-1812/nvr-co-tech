import { RATE_LIMIT, RATE_WINDOW_MS } from './config';

/**
 * A ceiling on how often one account can spend somebody else's credit.
 *
 * Be clear about what this is. It is a cost control, not a security control. It
 * counts in the memory of one server instance, so on a platform that runs
 * several the real ceiling is this multiplied by however many happen to be warm,
 * and a cold start resets it to nothing. A limit that had to hold exactly would
 * have to count in the database, which means a write on every question, and that
 * is a poor trade for a screen whose whole failure mode is a slightly larger
 * bill.
 *
 * What it does reliably catch is the thing that actually happens: one tab left
 * open with a retry loop, or one person holding the send key down. Both are
 * hundreds of requests from a single account against a single instance, which is
 * exactly the case a counter in memory sees perfectly.
 */

/** Timestamps of recent requests, newest last, per account. */
const seen = new Map<string, number[]>();

/**
 * The map is swept rather than left to grow.
 *
 * Without this it is a memory leak with a user id for a key: every account that
 * ever asks a question stays in it for the life of the process. The sweep is
 * done on write rather than on a timer, so an idle server does no work and holds
 * nothing.
 */
function sweep(now: number) {
  for (const [key, hits] of seen) {
    if (hits.length === 0 || now - hits[hits.length - 1] > RATE_WINDOW_MS) seen.delete(key);
  }
}

export type RateVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export function checkRate(userId: string, now = Date.now()): RateVerdict {
  // Cheap enough at this size to do on every call, and it keeps the sweep honest
  // about when it last ran without a second timestamp to maintain.
  if (seen.size > 512) sweep(now);

  const cutoff = now - RATE_WINDOW_MS;
  const hits = (seen.get(userId) ?? []).filter((t) => t > cutoff);

  if (hits.length >= RATE_LIMIT) {
    // How long until the oldest request in the window falls out of it, which is
    // when there is room for one more.
    const retry = Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000);
    seen.set(userId, hits);
    return { allowed: false, retryAfterSeconds: Math.max(retry, 1) };
  }

  hits.push(now);
  seen.set(userId, hits);
  return { allowed: true, remaining: RATE_LIMIT - hits.length };
}

/** Only for tests, which must not inherit counts from each other. */
export function resetRates() {
  seen.clear();
}

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { analyticsGate } from '@/lib/analytics/admin';
import { PREVIEW } from '@/lib/preview';
import type { Database } from '@/lib/supabase/types';
import { APOLLO_NOT_CONFIGURED, apolloKey } from './apollo/config';

/**
 * The guard in front of every Contact Finder route.
 *
 * Written once because there are a dozen routes and they all answer to the same
 * four questions, in the same order, and a route added later must not be able to
 * forget one. The layout asks the first two as well, but a layout guards a
 * screen and what needs guarding here is the spending: a route handler is
 * reachable directly, and the one thing on the other side of it is a paid API
 * on this platform's own key.
 *
 * The order is deliberate. Signed in, then on the allowlist, then not preview,
 * then configured — cheapest and most specific first, so the message a caller
 * gets names the thing that is actually wrong rather than the first thing that
 * happened to be checked.
 */

export type FinderSession = {
  supabase: SupabaseClient<Database>;
  userId: string;
  email: string | null;
  /** Present only from `requireApollo`. */
  apiKey: string;
};

type Refusal = { ok: false; response: NextResponse };
type Allowed<T> = { ok: true } & T;

function refuse(error: string, status: number): Refusal {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Signed in, on the allowlist, and not looking at sample data.
 *
 * Used by the routes that read or write this tool's own tables without touching
 * Apollo — history, the working list, the credit line, the pickers.
 */
export async function requireFinder(): Promise<
  Refusal | Allowed<Omit<FinderSession, 'apiKey'>>
> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return refuse('You are not signed in.', 401);

  const gate = await analyticsGate();
  if (!gate.allowed) {
    /*
     * 403 rather than 404 here, unlike the layout. A layout is a screen and
     * pretending it does not exist is a real defence; a JSON route answering
     * "not found" to a caller who is signed in and simply not permitted tells
     * them nothing they can act on, and the route's existence is already
     * evident from the request they just made.
     */
    return refuse(
      gate.reason === 'not-installed'
        ? 'Contact Finder is not set up on this environment yet.'
        : 'Contact Finder is limited to platform administrators.',
      403,
    );
  }

  if (PREVIEW) {
    return refuse(
      'Contact Finder searches a live contact database, which preview mode never calls. Sign in to the real workspace to use it.',
      503,
    );
  }

  const supabase = await createClient();
  return {
    ok: true,
    supabase: supabase as unknown as SupabaseClient<Database>,
    userId: user.id,
    email: user.authEmail ?? user.email ?? null,
  };
}

/** The same, plus the credential. Used by anything that reaches Apollo. */
export async function requireApollo(): Promise<Refusal | Allowed<FinderSession>> {
  const base = await requireFinder();
  if (!base.ok) return base;

  const key = apolloKey();
  // 503, not 500. Nothing is broken and nothing is a caller's fault: this
  // environment simply has no credential to search with.
  if (!key) return refuse(APOLLO_NOT_CONFIGURED, 503);

  return { ...base, apiKey: key };
}

/**
 * A ceiling on how often one person can hit a route that costs something.
 *
 * In-memory and per-instance, the same shape and the same honest caveat as the
 * company-brief route: on a serverless host the real ceiling is this number
 * times however many instances happen to be warm. It is a cost control, not a
 * security control, and it is still a large improvement on no limit at all. The
 * fix if it proves too loose is a shared store, not a different algorithm.
 *
 * Only the routes that bill a real per-request Apollo or model call are limited.
 * Nothing was limited while every caller was a colleague on the honour system;
 * a script looping any of these has nothing else to slow it down.
 */
const LIMITS: Readonly<Record<string, readonly [number, number]>> = {
  // Debounced client-side at 420ms while somebody is typing.
  count: [40, 60_000],
  // A deliberate button click, not one per keystroke.
  'parse-query': [12, 60_000],
  // A conversation: several messages a minute is normal.
  chat: [20, 60_000],
  search: [60, 60_000],
  enrich: [40, 60_000],
};

const hits = new Map<string, number[]>();

export function rateLimited(route: keyof typeof LIMITS | string, userId: string): boolean {
  const limit = LIMITS[route];
  if (!limit) return false;

  const [max, windowMs] = limit;
  const now = Date.now();

  // Cheap sweep, so an instance that has been warm for hours does not grow a
  // map entry per person who has ever used it.
  if (hits.size > 512) {
    for (const [key, times] of hits) {
      if (times.length === 0 || now - times[times.length - 1] > windowMs) hits.delete(key);
    }
  }

  const key = `${route}:${userId}`;
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) return true;

  recent.push(now);
  hits.set(key, recent);
  return false;
}

export const TOO_MANY = NextResponse.json(
  { error: 'That is a lot of requests in a short time. Wait a moment and try again.' },
  { status: 429 },
);

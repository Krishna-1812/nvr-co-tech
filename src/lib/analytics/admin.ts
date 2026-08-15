import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Who is allowed to see any of this.
 *
 * The allowlist is a table in Postgres, not a constant here and not an
 * environment variable, and the whole of this file exists to make sure there is
 * never a second copy of it. Two lists — one deciding what the row-level
 * policies permit, one deciding what the navigation shows — drift apart the
 * first time somebody is added to only one, and the failure is silent in the
 * worst possible way: the menu item appears, the page loads, and every table on
 * it is empty. Nobody reports that as a permissions bug. They report it as
 * "the analytics are broken".
 *
 * So the application asks the database. `is_analytics_admin()` is the same
 * function every select policy in migration 0010 calls, which means the answer
 * this returns and the rows Postgres will actually hand over cannot disagree.
 *
 * Adding a colleague is one INSERT into `analytics_admins`, with no deploy.
 */

/** The address seeded by migration 0010. Named here only so a message can say it. */
export const FIRST_ADMIN = 'krishna.ladha18@gmail.com';

export type Gate =
  | { allowed: true }
  /** Signed in, but not on the list. The screens pretend not to exist. */
  | { allowed: false; reason: 'not-admin' }
  /** Migration 0010 has not been applied to this database yet. */
  | { allowed: false; reason: 'not-installed' };

/**
 * Memoised per request, like getCurrentUser, because the layout, the page and
 * sometimes a server action all ask the same question while rendering one
 * screen, and each ask is a round-trip to Supabase.
 */
export const analyticsGate = cache(async (): Promise<Gate> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_analytics_admin');

  if (error) {
    /*
     * PGRST202 is PostgREST for "no such function", which here means one
     * specific thing: the migration has not been run. That deserves its own
     * answer rather than being folded into "you are not an admin", because the
     * two need completely different things done about them and only one of them
     * is about the person reading the screen.
     */
    return { allowed: false, reason: error.code === 'PGRST202' ? 'not-installed' : 'not-admin' };
  }

  return data === true ? { allowed: true } : { allowed: false, reason: 'not-admin' };
});

export async function isAnalyticsAdmin(): Promise<boolean> {
  return (await analyticsGate()).allowed;
}

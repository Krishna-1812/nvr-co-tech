import { createClient } from '@/lib/supabase/server';
import { AGENTS } from '@/lib/marketing/content';
import { aliasAgent } from './aliases';

/**
 * Recording that somebody opened a tool.
 *
 * One function, called from the places where a tool is genuinely used rather
 * than merely visited. That distinction is the whole design of this module: a
 * page view is already recorded by the tracker on every navigation, so counting
 * arrivals here would produce a second, worse copy of the page-view log. A run
 * is the tool doing its work — a reconciliation completing, a question answered.
 *
 * Deliberately says nothing about what happened inside. This system cannot see
 * into a reconciliation or read an answer, and the usage screen says so in as
 * many words rather than implying the count measures work done.
 */

/** The tools that are live and therefore countable. Slugs come from the roster. */
export const METERED = AGENTS.filter((agent) => agent.stage === 'live').map((a) => a.slug);

export type RunOutcome = {
  /** False once somebody is past their allowance. Nothing is refused on it. */
  withinCap: boolean;
  used: number;
  cap: number;
};

/**
 * Best-effort, and never in the way.
 *
 * A reconciliation that ran has run whether or not the row counting it landed.
 * Every failure path here returns null and is swallowed, for the same reason the
 * tracker swallows its own: a measurement that can break the thing it measures
 * is worse than no measurement.
 */
export async function recordRun(slug: string): Promise<RunOutcome | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('record_agent_run', {
      p_slug: aliasAgent(slug),
    });

    if (error || !data || data.length === 0) return null;

    const row = data[0];
    return { withinCap: row.allowed, used: row.used, cap: row.cap };
  } catch {
    return null;
  }
}

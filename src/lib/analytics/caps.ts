import { createClient } from '@/lib/supabase/server';

/**
 * The per-tool, per-account allowance — asked for rather than restated.
 *
 * The number lives in `agent_run_cap()` in migration 0023, and that is
 * deliberate: the same function is read by the code that records a run and by
 * the screen that reports on it, so the figure shown and the figure applied
 * cannot drift apart. A constant here as well would be a second source of truth,
 * and the failure mode would be a dashboard confidently reporting "8 of 10"
 * about a limit that had quietly become fifteen.
 *
 * The fallback exists only for a database where 0023 has not been applied yet.
 * It is the same value the migration defines, and if the two ever disagree the
 * migration is right.
 */
const FALLBACK = 10;

export async function readRunCap(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('agent_run_cap');
    if (error || typeof data !== 'number') return FALLBACK;
    return data;
  } catch {
    return FALLBACK;
  }
}

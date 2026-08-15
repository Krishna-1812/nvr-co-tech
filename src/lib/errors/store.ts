import { createClient } from '@/lib/supabase/server';

export type ErrorLogRow = {
  id: number;
  occurred_at: string;
  scope: 'client' | 'server';
  route: string | null;
  message: string;
  digest: string | null;
  stack: string | null;
  user_email: string | null;
  extra: Record<string, unknown> | null;
};

/**
 * Recent rows from error_log, newest first.
 *
 * Reached only from the admin screen, and RLS is what actually enforces that —
 * the same `is_analytics_admin()` policy every other operational table in
 * migration 0011 uses — this is just the query.
 */
export async function readErrors(limit = 200): Promise<ErrorLogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('error_log')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as ErrorLogRow[];
}

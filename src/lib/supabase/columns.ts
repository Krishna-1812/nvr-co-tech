import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Selects that name a column the database may not have yet.
 *
 * Migrations in this project are applied by hand in the Supabase SQL editor, while
 * a push to main deploys itself. New code therefore reaches production before the
 * schema it was written against, and the gap between the two is however long it
 * takes somebody to open a browser tab.
 *
 * PostgREST answers a select naming an unknown column with a 400, not a null. That
 * is what turned profiles.avatar_url — a picture — into an outage. getCurrentUser()
 * read the error as "no profile", returned null, requireUser() took that to mean
 * "not signed in" and redirected to /login, and the proxy found a perfectly good
 * session sitting there and sent the browser back to /hub. Signing in bounced
 * between the two until the browser gave up.
 *
 * A face is not worth that. Queries built through here ask for the column, and if
 * the answer is "no such column" they ask again without it and the app falls back
 * to initials. One server process pays for one failed query, because the answer is
 * remembered.
 */

/**
 * Whether the database still has profiles.avatar_url.
 *
 * Optimistic, and per process: a cold start or a deploy asks again, so applying
 * the migration brings the faces back without a code change.
 */
let hasAvatarUrl = true;

/** `cols`, plus avatar_url while the database has it. */
export function withAvatar(cols: string): string {
  return hasAvatarUrl ? `${cols}, avatar_url` : cols;
}

/** The columns every embedded person join asks for. */
export function personCols(): string {
  return withAvatar('full_name, email');
}

/**
 * 42703 is Postgres' undefined_column. The message names the alias PostgREST gave
 * the table rather than the table itself — `column profiles_1.avatar_url does not
 * exist` inside a join — so only the column name is matched.
 */
function isMissingAvatar(error: PostgrestError | null): boolean {
  return error?.code === '42703' && error.message.includes('avatar_url');
}

/**
 * Runs a query that asked for a column the database may not have, and runs it once
 * more without that column if it turns out not to be there.
 *
 * `build` is a callback rather than a query, because the second attempt needs a
 * different select string and a supabase query cannot be rewritten once built. Any
 * other error is passed straight back, untouched and un-remembered: a column that
 * does not exist stays absent until somebody runs a migration, but a network blip
 * must not cost this process its faces for the rest of its life.
 */
export async function tolerateMissingColumns<R extends { error: PostgrestError | null }>(
  build: () => PromiseLike<R>,
): Promise<R> {
  const first = await build();
  if (!isMissingAvatar(first.error)) return first;

  hasAvatarUrl = false;
  return build();
}

import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';
import { safeAvatarUrl } from '@/lib/avatar';
import { PREVIEW } from '@/lib/preview';
import { createPreviewClient } from '@/lib/preview/client';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads the session from cookies, so RLS applies as the signed-in user.
 *
 * Wrapped in React's `cache`, which memoises per request rather than across them.
 * Building a client is cheap, but it was being built three to five times on every
 * page — once in the shell layout, once in the page, again in whatever else needed
 * a query — and each one re-awaited `cookies()`. One per request is all any of
 * them wanted.
 */
export const createClient = cache(async () => {
  // Preview mode: no database, no RLS, fixtures instead. Dev builds only.
  if (PREVIEW) {
    return createPreviewClient() as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
});

/**
 * The signed-in user together with their profile (role, name).
 * Returns null when there is no session.
 *
 * Also memoised per request, and this is the one that mattered.
 *
 * Two things happen in here and both go over the network. `auth.getUser()` asks
 * the Supabase auth server to validate the token — it deliberately does not just
 * decode the cookie, which is why it is the call you are told to trust — and the
 * profile row is a second query. So one call to this function costs two
 * round-trips to Supabase.
 *
 * It was being made twice on every signed-in page, because the shell layout needs
 * the role to build the rail and then the page needs the same user again, and
 * three times under /admin, which has a layout of its own. That is four to six
 * serial round-trips before any HTML could be produced, on every navigation, all
 * of them asking the same question of the same request and getting the same
 * answer. Memoising collapses them to one and no call site had to change.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, avatar_url')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  /*
   * Your own picture, preferring the stored column and falling back to the
   * session.
   *
   * The column is what lets a face appear next to your name on somebody else's
   * screen, and it is written at sign-up and refreshed by sync_own_avatar() on
   * each OAuth sign-in. The session metadata is the fallback for the moment
   * between signing in for the first time and that sync landing, and for a project
   * where 0006 has not been applied yet.
   */
  const meta = user.user_metadata as { avatar_url?: unknown; picture?: unknown } | null;
  const avatarUrl =
    safeAvatarUrl(profile.avatar_url) ??
    safeAvatarUrl(meta?.avatar_url) ??
    safeAvatarUrl(meta?.picture);

  return { ...profile, authEmail: user.email ?? profile.email, avatarUrl };
});

/** Same, but redirects to /login instead of returning null. Use in protected pages. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return user!;
}

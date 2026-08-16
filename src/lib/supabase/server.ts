import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database, Profile } from './types';
import { tolerateMissingColumns, withAvatar } from './columns';
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
 * The profile columns a signed-in session needs. avatar_url is optional because
 * the select drops it on a database that has not got the column yet — a face is
 * the one thing here the app can render without.
 */
type SessionProfile = Pick<
  Profile,
  'id' | 'email' | 'full_name' | 'role' | 'is_active' | 'organization_id'
> & {
  avatar_url?: string | null;
};

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

  const { data, error } = await tolerateMissingColumns(() =>
    supabase
      .from('profiles')
      .select(withAvatar('id, email, full_name, role, is_active, organization_id'))
      .eq('id', user.id)
      .single(),
  );

  /*
   * supabase-js infers the row from the select string as a literal type, and this
   * one is built at runtime, so the inference has nothing to work from. Naming the
   * shape here is what the rest of the app types itself against, so it earns the
   * assertion — everything from the role on the rail to the account menu is this.
   */
  const profile = data as unknown as SessionProfile | null;

  /*
   * A session that cannot be resolved to a profile is not the same thing as no
   * session, and returning null said the second. requireUser() then redirected to
   * /login, where the proxy found the valid session and redirected back here, and
   * the browser bounced between the two until it gave up — which is how a single
   * failing query became "the site will not open after signing in".
   *
   * PGRST116 is the one error that genuinely means no row, and it keeps the old
   * behaviour: RLS can legitimately hide a profile, and /login is the right answer
   * to that. Anything else is a fault, and a fault should say so once rather than
   * impersonate a signed-out user forever.
   */
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Could not read your profile: ${error.message}`);
  }

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

  return {
    ...profile,
    authEmail: user.email ?? profile.email,
    avatarUrl,
    organizationId: profile.organization_id,
  };
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

/**
 * Same as requireUser(), and additionally redirects to /onboarding when the
 * session has no organization yet.
 *
 * Use this rather than requireUser() at the top of anything that reads or
 * writes chapters, events or vouchers — every one of those is organization-
 * scoped now (see migration 0012), and a profile with organization_id still
 * null would see nothing under RLS regardless, which reads as a blank screen
 * rather than as the "finish setting up" step it actually is.
 */
export async function requireOrgMember() {
  const user = await requireUser();
  if (!user.organizationId) {
    const { redirect } = await import('next/navigation');
    redirect('/onboarding');
  }
  return user as typeof user & { organizationId: string };
}

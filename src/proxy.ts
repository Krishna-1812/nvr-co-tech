import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PREVIEW } from '@/lib/preview';
import { AFTER_LOGIN, isProtectedPath } from '@/lib/routes';

/*
 * Gating is a deny-list (see lib/routes.ts) rather than the allow-list it used
 * to be, because the public surface is now the larger and faster-growing one:
 * with an allow-list, every new marketing page needs a matching edit here, and
 * forgetting one hides a public page behind a login wall. Erring in this
 * direction is also the safer one — this is not the only gate. Every page under
 * (app) goes through requireUser(), and RLS is what actually protects the data.
 */

/**
 * Refreshes the Supabase session on every request and gates protected routes.
 * (Next 16 renamed this convention from middleware.ts to proxy.ts.)
 *
 * v1 checked auth only inside React components, so a protected page flashed
 * before redirecting. Here an unauthenticated request never reaches the page.
 */
export default async function proxy(request: NextRequest) {
  /*
   * Preview mode has no session to refresh and no real user to gate on, so the
   * whole check is skipped. This is an authentication bypass by definition —
   * see lib/preview/index.ts for the two conditions that must both hold before
   * PREVIEW can ever be true, one of which is "not a production build".
   */
  if (PREVIEW) {
    if (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')) {
      const url = request.nextUrl.clone();
      url.pathname = AFTER_LOGIN;
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  const { pathname } = request.nextUrl;

  /*
   * No session cookie, no reason to ask Supabase anything.
   *
   * `getUser()` below is a network round-trip to the auth server on every single
   * request this matcher sees — and for a visitor who has never signed in there is
   * nothing for it to validate and no token for it to refresh. Skipping it takes
   * that round-trip off every page of the public site, which is most of the
   * traffic and the part where first impressions are formed.
   *
   * Safe by construction: the session lives in these cookies, so their absence is
   * the same answer `getUser()` would have come back with, only without the wait.
   */
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  if (!hasSession) {
    if (isProtectedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Do not remove: this refreshes the auth token cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Come back here after signing in.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = AFTER_LOGIN;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

/*
 * Everything that is not a page.
 *
 * The route files (robots.txt, sitemap.xml, the OG image) and font and icon
 * requests were all running this proxy, and none of them has a session to refresh
 * or a route to gate. Fonts already sat under _next/static; the rest are named
 * here by extension.
 *
 * `.js` joined the list with the analytics tracker: /a.js is a static file
 * requested by every visitor to the public site, and running a session refresh
 * for it would put this proxy on the hot path of the one request that exists to
 * avoid being on anybody's hot path.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|txt|xml|webmanifest)$).*)',
  ],
};

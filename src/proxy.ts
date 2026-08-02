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

  const { pathname } = request.nextUrl;

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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

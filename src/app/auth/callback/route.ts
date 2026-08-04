import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AFTER_LOGIN } from '@/lib/routes';

/**
 * Where Supabase sends the browser back after Google sign-in or an emailed
 * confirmation link. It arrives with a one-time `code`, which is exchanged here
 * for a session cookie.
 *
 * Without this route the "Continue with Google" button on /login sent people to
 * a 404 and no session was ever established.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  /*
   * Supabase reports a refused or expired link by redirecting here with an
   * error instead of a code — e.g. the user dismissed Google's consent screen.
   * Surface it on the login page rather than silently landing on the dashboard.
   */
  const error = searchParams.get('error_description') ?? searchParams.get('error');
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Sign-in link was incomplete.')}`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('That sign-in link has expired. Please try again.')}`,
    );
  }

  /*
   * Copy the identity provider's picture onto the profile row.
   *
   * This is the only moment we know it may have changed, and the row is what lets
   * a face appear beside this person's name on somebody else's screen — a session
   * only ever contains one user, so reading it from the session could never do
   * that. The function takes no arguments and reads auth.users itself, so nothing
   * here can choose what URL other people's browsers will fetch.
   *
   * Failure is ignored on purpose. A picture is not worth blocking a sign-in for,
   * and this call also does not exist on a project where 0006 has not been applied.
   */
  try {
    await supabase.rpc('sync_own_avatar');
  } catch {
    // Deliberately swallowed. See above.
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * `next` comes from the query string, so it is attacker-controllable. Only a
 * path on this site is allowed — `//evil.com` and `https://evil.com` would both
 * otherwise be honoured by the browser as an off-site redirect.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return AFTER_LOGIN;
  return value;
}

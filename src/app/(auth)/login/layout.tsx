import type { Metadata } from 'next';

/**
 * A title for the sign-in page.
 *
 * The page itself is a client component, so it cannot export metadata, and
 * without this the browser tab said "The Finance Intelligence · AI tools for
 * finance teams" — the home page's own absolute title, on the sign-in screen.
 * Somebody with a dozen tabs open had no way to find this one.
 *
 * A layout at the segment can export what the page cannot, which is four small
 * files across the four auth routes rather than splitting four carefully built
 * forms into a server shell and a client body each.
 */
export const metadata: Metadata = { title: 'Sign in' };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

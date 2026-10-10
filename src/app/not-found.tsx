import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/server';
import { NotFoundPanel } from '@/components/marketing/NotFoundPanel';
import { PublicShell } from '@/components/marketing/PublicShell';
import { ArchScene } from '@/components/ui/Scene';

/**
 * Every URL on this origin that matches no route at all, plus the deliberate
 * notFound() calls that are thrown from a layout rather than from a page —
 * which is the analytics gate, and is why the copy below names nothing.
 *
 * ── Why this page has two faces ─────────────────────────────────────────────
 *
 * It used to have one, and it was the application's. That was the wrong way
 * round for the commonest visitor it gets: somebody who mistyped an address on
 * the public site, or followed a stale link into it, landed on a light-themed
 * app screen offering them a sign-in button for a product they had not met yet.
 * The site's own 404 existed but sat inside the marketing route group, where a
 * root not-found cannot reach it — Next renders this file inside the *root*
 * layout, with no route-group layout in the tree.
 *
 * So it asks who is here. No session is a visitor, and a visitor gets the public
 * site's 404 inside the public site's frame. A session is somebody already
 * inside the product, and the six in-app notFound() calls all reach this page,
 * so they keep the application's.
 *
 * The one path that reads oddly either way is a signed-in person mistyping a
 * public URL. They get the app's 404, which is the right answer for the five
 * other things that bring a signed-in person here and a harmless one for this.
 */

// Title only. Next stamps its own `noindex` on a not-found response, so setting
// `robots` here would put a second, redundant robots tag beside it — which is
// exactly what was wrong with this page's head before (see the root layout).
export const metadata: Metadata = {
  title: 'Page not found',
};

export default async function NotFound() {
  if (!(await hasSession())) {
    return (
      <PublicShell>
        <NotFoundPanel />
      </PublicShell>
    );
  }

  return <AppNotFound />;
}

/**
 * Whether anybody is signed in, with a failure counted as nobody.
 *
 * A 404 page is the last thing on a site that should be able to return a 500,
 * and this one can: it asks Supabase, and Supabase throws rather than returns
 * when its keys are missing or its network is down. In that case the honest
 * answer is that we do not know who this is, and the page that serves a person
 * we do not know is the public one.
 */
async function hasSession(): Promise<boolean> {
  try {
    return (await getCurrentUser()) !== null;
  } catch {
    return false;
  }
}

/**
 * The 404 for somebody already inside the product, and there are more kinds
 * than there look to be: a mistyped URL, but also an unresolved voucher,
 * organisation, visitor or reconciliation id, and the analytics gate.
 *
 * That last one is why the copy names nothing. `(insight)/layout.tsx` calls
 * `notFound()` rather than redirecting a signed-in non-admin, precisely so that
 * nothing tells them there is an /analytics — this page is their cover story.
 * It used to say "the voucher may have been deleted" and offer them a voucher
 * register, which was the wrong noun on four of the six routes and, for the
 * fifth, an invention.
 *
 * So: say what is true of all of them, and hand back the one destination that
 * is right whatever they were looking for.
 */
function AppNotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] text-center">
        {/*
          The row of doorways from the workspace's own hub, which is where the
          one button below goes. A plain picture rather than a claim: the copy
          names nothing, for the reason given above, and so does the scene.
        */}
        <ArchScene motif="doorways" className="mx-auto h-60 min-h-0 w-48" />

        <p className="a-label mt-8">Error 404</p>
        <h1 className="m-display mt-3 text-[2.25rem] leading-[1.1] tracking-tight">
          This page does not exist
        </h1>
        <p className="text-muted mx-auto mt-3 max-w-sm text-sm leading-relaxed">
          The link may be out of date. Whatever it pointed at may have been deleted, or it may
          belong to somebody whose records you cannot see.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link
            href="/hub"
            className="elev-2 inline-flex h-11 items-center rounded-full bg-[var(--action)] px-6 text-sm font-semibold text-[var(--on-action)] transition hover:bg-[var(--action-hover)]"
          >
            Your workspace
          </Link>
        </div>
      </div>
    </div>
  );
}

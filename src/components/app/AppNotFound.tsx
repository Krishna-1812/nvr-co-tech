import Link from 'next/link';
import { ArchScene } from '@/components/ui/Scene';

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
export function AppNotFound() {
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

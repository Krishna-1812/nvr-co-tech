import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { getCurrentUser } from '@/lib/supabase/server';

/**
 * Every 404 on the signed-in side of the app, and there are more kinds than
 * there look to be. A mistyped URL, but also six deliberate `notFound()`
 * calls: an unresolved voucher, organisation, visitor or reconciliation id,
 * and the analytics gate.
 *
 * That last one is why the copy names nothing. `(insight)/layout.tsx` calls
 * `notFound()` rather than redirecting a signed-in non-admin, precisely so
 * that nothing tells them there is an /analytics — this page is their cover
 * story. It used to say "the voucher may have been deleted" and offer them a
 * voucher register, which was the wrong noun on four of the six routes and,
 * for the fifth, an invention.
 *
 * So: say what is true of all of them, and hand back the one destination that
 * is right whatever they were looking for.
 */
export default async function NotFound() {
  // A signed-out visitor can reach this too — any mistyped in-app URL resolves
  // here regardless of session — and "Your workspace" sent them straight into a
  // login redirect with no explanation.
  const user = await getCurrentUser();

  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] w-full max-w-md text-center">
        <div className="relative mx-auto w-fit">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 m-auto size-24 rounded-full bg-[radial-gradient(circle,var(--color-brand-500),transparent_70%)] opacity-20 blur-2xl"
          />
          <span className="surface-lit text-subtle grid size-16 place-items-center rounded-2xl">
            <FileQuestion className="size-7" aria-hidden />
          </span>
        </div>

        <p className="numeric text-subtle mt-6 text-sm font-semibold">404</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">This page does not exist</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          The link may be out of date. Whatever it pointed at may have been deleted, or it may
          belong to somebody whose records you cannot see.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {user ? (
            <Link
              href="/hub"
              className="gradient-brand elev-brand inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition hover:brightness-110"
            >
              Your workspace
            </Link>
          ) : (
            <Link
              href="/login"
              className="gradient-brand elev-brand inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { getCurrentUser } from '@/lib/supabase/server';

/**
 * Also what you land on when a voucher id does not resolve — a page calling
 * notFound() renders this. Both readings are covered by the copy.
 */
export default async function NotFound() {
  // A signed-out visitor can reach this too — any mistyped in-app URL
  // resolves here regardless of session — and "Your workspace" / "All
  // vouchers" sent them straight into a login redirect with no explanation.
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
          The link may be out of date, or the voucher may have been deleted or belong to someone
          whose records you cannot see.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {user ? (
            <>
              <Link
                href="/hub"
                className="gradient-brand elev-brand inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Your workspace
              </Link>
              <Link
                href="/vouchers"
                className="surface elev-1 inline-flex h-10 items-center rounded-lg border-[var(--border-strong)] px-4 text-sm font-semibold transition hover:bg-[var(--surface-sunken)]"
              >
                All vouchers
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="gradient-brand elev-brand inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

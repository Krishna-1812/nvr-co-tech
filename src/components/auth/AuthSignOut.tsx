'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * The way out of the auth screens for somebody who is already signed in.
 *
 * This exists because of one specific trap. Every other sign-out control in the
 * product — the account menu, the command palette, Settings — sits inside a
 * layout that calls requireOrgMember(), and a profile with no organization is
 * redirected out of all of them straight back to /onboarding. So an account
 * that had signed in but not joined anything could reach exactly one page, and
 * that page had no way to sign out: the invite-for-a-different-address branch
 * told the reader to sign in as somebody else while giving them no means to do
 * it, and clearing cookies was the only exit from the application.
 *
 * It is also the escape hatch for a session whose profile row cannot be read at
 * all, which is why the layout hands us the address from the auth session
 * rather than from `profiles` — the broken case is exactly the one where the
 * profile is what is missing.
 */
export function AuthSignOut({ email }: { email: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <span className="m-dim-2 inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs">
      {email ? <>Signed in as {email}</> : <>Already signed in</>}
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--m-indigo)] focus-visible:outline-none disabled:opacity-60"
      >
        <LogOut className="size-3" aria-hidden />
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </span>
  );
}

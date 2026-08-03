'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Shared between /login and /signup so the two screens cannot drift apart.
 *
 * Styled against the marketing tokens rather than the app's, because these
 * screens live in the night skin. The red here is a fixed pair rather than the
 * app's `dark:` variants: there is only ever one background behind it.
 */

export function AuthError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="flex animate-[pop_0.35s_cubic-bezier(0.34,1.56,0.64,1)_backwards] items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed"
      style={{
        borderColor: 'color-mix(in oklab, var(--m-rose) 34%, transparent)',
        background: 'color-mix(in oklab, var(--m-rose) 12%, transparent)',
        color: 'color-mix(in oklab, var(--m-rose) 72%, white)',
      }}
    >
      <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--m-line)]" />
      <span className="m-mono m-dim-2 text-[10px] tracking-[0.16em] uppercase">or</span>
      <span className="h-px flex-1 bg-[var(--m-line)]" />
    </div>
  );
}

/** The primary action. Matches the marketing CTA, at full width and form height. */
export function AuthSubmit({
  children,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[14px] font-semibold text-white transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--m-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--m-bg)] focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
      style={{
        backgroundImage: 'var(--m-grad)',
        boxShadow: '0 10px 30px oklch(0.64 0.18 274 / 0.35)',
      }}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function GoogleButton({
  next,
  onError,
  label = 'Continue with Google',
}: {
  next: string;
  onError: (message: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  const go = async () => {
    onError('');
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser leaves for Google, so `busy` is only reset on failure.
    if (error) {
      setBusy(false);
      onError('We could not start Google sign-in. Please try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--m-line-2)] bg-white/[0.03] text-[14px] font-semibold text-[var(--m-ink)] transition hover:border-[var(--m-ink)]/40 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-[var(--m-indigo)] focus-visible:outline-none active:scale-[0.99] disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleMark />}
      {label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
      />
    </svg>
  );
}

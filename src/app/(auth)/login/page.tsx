'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { signIn as signInAction } from '@/app/actions/auth';
import { AuthError, AuthSubmit, GoogleButton, OrDivider } from '@/components/auth/AuthBits';
import { AuthCard, AuthHeading } from '@/components/auth/AuthCard';
import { AuthField, AuthInput, AuthPassword } from '@/components/auth/AuthField';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import { AFTER_LOGIN } from '@/lib/routes';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? AFTER_LOGIN;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // The OAuth callback route reports failures by redirecting back with ?error=.
  const [error, setError] = useState(params.get('error') ?? '');
  const [busy, setBusy] = useState(false);
  // Set only for 'email_not_confirmed', so the error can offer to resend it.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnconfirmedEmail('');
    setResendState('idle');
    setBusy(true);
    const result = await signInAction({ email, password });
    if (!result.ok) {
      setBusy(false);
      /*
       * Every failure used to get the same "wrong password" message, including
       * a real account that simply never confirmed its email — which sends
       * that person looking for a typo that was never there, with no hint
       * that a confirmation link is what they actually need.
       */
      if (result.code === 'email_not_confirmed') {
        setError('Please confirm your email first. Check your inbox for the link we sent.');
        setUnconfirmedEmail(email);
      } else if (result.code === 'rate_limited') {
        setError(result.error);
      } else {
        setError('That email and password did not work. Please try again.');
      }
      return;
    }
    router.push(next);
    router.refresh();
  };

  const resendConfirmation = async () => {
    setResendState('sending');
    await createClient().auth.resend({ type: 'signup', email: unconfirmedEmail });
    setResendState('sent');
  };

  return (
    <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <AuthHeading
        title={
          <>
            Welcome <span className="m-serif m-grad-text">back.</span>
          </>
        }
        lead="Sign in to raise a voucher, or to clear the ones waiting on you."
      />

      <AuthCard
        footer={
          <p className="m-dim text-[13px]">
            First time here?{' '}
            <Link
              // Carries an invite link's ?next= through to signup, so accepting
              // an invite survives someone not having an account yet.
              href={next === AFTER_LOGIN ? '/signup' : `/signup?next=${encodeURIComponent(next)}`}
              className="font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
            >
              Create an account
            </Link>
          </p>
        }
      >
        <form onSubmit={signIn} className="space-y-4">
          <AuthField label="Email" htmlFor="email">
            <AuthInput
              id="email"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="you@thefinanceintelligence.com"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </AuthField>

          <AuthField
            label="Password"
            htmlFor="password"
            action={
              <Link
                href="/forgot-password"
                className="text-[12.5px] font-medium text-[var(--m-dim)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
              >
                Forgot password?
              </Link>
            }
          >
            <AuthPassword
              id="password"
              icon={Lock}
              autoComplete="current-password"
              placeholder="Your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </AuthField>

          <AuthError message={error} />

          {unconfirmedEmail && resendState !== 'sent' && (
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resendState === 'sending'}
              className="text-[13px] font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline disabled:opacity-60"
            >
              {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
            </button>
          )}
          {resendState === 'sent' && (
            <p className="m-dim text-[13px]">Sent. Check your inbox.</p>
          )}

          <div className="pt-1">
            <AuthSubmit loading={busy}>
              Sign in
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </AuthSubmit>
          </div>
        </form>

        <OrDivider />
        <GoogleButton next={next} onError={setError} />
      </AuthCard>
    </div>
  );
}

export default function LoginPage() {
  /*
   * useSearchParams opts this page out of prerendering, so what ships as static
   * HTML is the fallback. It has to hold the page's shape — with `null` the
   * whole column was empty until hydration, which on a slow connection reads as
   * a half-broken page rather than a loading one.
   */
  return (
    <Suspense fallback={<AuthFormSkeleton fields={2} />}>
      <LoginForm />
    </Suspense>
  );
}

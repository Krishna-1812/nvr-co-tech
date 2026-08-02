'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthError, AuthSubmit, GoogleButton, OrDivider } from '@/components/auth/AuthBits';
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

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError('That email and password combination did not work.');
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <div className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <h1 className="m-display text-[2.15rem]">
        Welcome <span className="m-serif m-grad-text">back.</span>
      </h1>
      <p className="m-dim mt-2.5 text-[14px]">Sign in to raise and approve vouchers.</p>

      <form onSubmit={signIn} className="mt-9 space-y-4">
        <AuthField label="Email" htmlFor="email">
          <AuthInput
            id="email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@nvrco.in"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthField>

        <AuthField label="Password" htmlFor="password">
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

      <p className="m-dim mt-8 text-center text-[13.5px]">
        No account?{' '}
        <Link
          href="/signup"
          className="font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  /*
   * useSearchParams opts this page out of prerendering, so what ships as static
   * HTML is the fallback. It has to hold the form's shape — with `null` the
   * whole right-hand column was empty until hydration, which on a slow
   * connection reads as a half-broken page rather than a loading one.
   */
  return (
    <Suspense fallback={<AuthFormSkeleton fields={2} />}>
      <LoginForm />
    </Suspense>
  );
}

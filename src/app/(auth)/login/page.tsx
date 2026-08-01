'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui/primitives';
import { AuthError, GoogleButton, OrDivider } from '@/components/auth/AuthBits';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

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
    <div className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="text-muted mt-1.5 text-sm">Sign in to raise and approve vouchers.</p>

      <form onSubmit={signIn} className="mt-8 space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@nvrco.in"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <AuthError message={error} />

        <Button type="submit" variant="primary" size="lg" loading={busy} className="group w-full">
          Sign in
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Button>
      </form>

      <OrDivider />
      <GoogleButton next={next} onError={setError} />

      <p className="text-muted mt-8 text-center text-sm">
        No account?{' '}
        <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

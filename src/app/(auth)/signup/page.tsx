'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui/primitives';
import { AuthError, GoogleButton, OrDivider } from '@/components/auth/AuthBits';
import { AFTER_LOGIN } from '@/lib/routes';

const MIN_PASSWORD = 8;

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? AFTER_LOGIN;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkInbox, setCheckInbox] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD) {
      setError(`Please use at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setBusy(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        // Read by the handle_new_user trigger to populate profiles.full_name,
        // which is what gets printed on the voucher as "Initiated By".
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setBusy(false);
      setError(
        error.message.toLowerCase().includes('already')
          ? 'An account with that email already exists. Try signing in instead.'
          : error.message,
      );
      return;
    }

    /*
     * With email confirmation on, signUp returns a user but no session — the
     * account is not usable until the emailed link is followed. With it off, a
     * session arrives immediately and we can go straight in.
     */
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }

    setBusy(false);
    setCheckInbox(true);
  };

  if (checkInbox) {
    return (
      <div className="animate-[pop_0.35s_cubic-bezier(0.34,1.56,0.64,1)_backwards] text-center">
        <span className="gradient-brand elev-brand mx-auto grid size-12 place-items-center rounded-2xl text-white">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Confirm your email</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          We sent a link to <span className="font-semibold text-[var(--text-c)]">{email}</span>.
          Open it to activate your account.
        </p>
        <p className="text-subtle mt-6 text-xs leading-relaxed">
          New accounts start as a <span className="font-semibold">Member</span> — you can raise
          vouchers straight away. Approval rights are granted by an administrator.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex text-sm font-semibold text-brand-600 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="text-muted mt-1.5 text-sm">It takes a moment. No approval needed to start.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field
          label="Full name"
          htmlFor="full_name"
          required
          hint="Printed on vouchers you raise or approve."
        >
          <Input
            id="full_name"
            autoComplete="name"
            placeholder="Vivek Gaggar"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="email" required>
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

        <Field label="Password" htmlFor="password" required hint={`At least ${MIN_PASSWORD} characters.`}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <AuthError message={error} />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          disabled={!fullName.trim()}
          className="group w-full"
        >
          Create account
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Button>
      </form>

      <OrDivider />
      <GoogleButton next={next} onError={setError} label="Sign up with Google" />

      <p className="text-muted mt-8 text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

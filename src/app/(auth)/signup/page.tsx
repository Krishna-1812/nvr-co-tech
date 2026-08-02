'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Mail, MailCheck, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthError, AuthSubmit, GoogleButton, OrDivider } from '@/components/auth/AuthBits';
import { AuthField, AuthInput, AuthPassword } from '@/components/auth/AuthField';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import { LogoMark } from '@/components/marketing/Logo';
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
      <div className="animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_backwards] text-center">
        <span
          className="mx-auto grid size-14 place-items-center rounded-2xl text-white"
          style={{
            backgroundImage: 'var(--m-grad)',
            boxShadow: '0 12px 34px oklch(0.64 0.18 274 / 0.4)',
          }}
        >
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h1 className="m-display mt-6 text-[1.9rem]">Confirm your email</h1>
        <p className="m-dim mt-3 text-[14px] leading-relaxed">
          We sent a link to <span className="font-semibold text-[var(--m-ink)]">{email}</span>. Open
          it to activate your account.
        </p>
        <p className="m-dim-2 mt-7 rounded-xl border border-[var(--m-line)] bg-white/[0.025] px-4 py-3.5 text-[12.5px] leading-relaxed">
          New accounts start as a <span className="font-semibold text-[var(--m-ink)]">Member</span> —
          you can raise vouchers straight away. Approval rights are granted by an administrator.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex text-[13.5px] font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <h1 className="m-display text-[2.15rem]">
        Create your <span className="m-serif m-grad-text">account.</span>
      </h1>
      <p className="m-dim mt-2.5 text-[14px]">It takes a moment. No approval needed to start.</p>

      <form onSubmit={submit} className="mt-9 space-y-4">
        <AuthField
          label="Full name"
          htmlFor="full_name"
          hint="Printed on vouchers you raise or approve."
        >
          <AuthInput
            id="full_name"
            icon={User}
            autoComplete="name"
            placeholder="Vivek Gaggar"
            required
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </AuthField>

        <AuthField label="Email" htmlFor="email">
          <AuthInput
            id="email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@nvrco.in"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthField>

        <AuthField
          label="Password"
          htmlFor="password"
          hint={`At least ${MIN_PASSWORD} characters.`}
        >
          <AuthPassword
            id="password"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Choose a password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthField>

        <AuthError message={error} />

        <div className="pt-1">
          <AuthSubmit loading={busy} disabled={!fullName.trim()}>
            Create account
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </AuthSubmit>
        </div>
      </form>

      <OrDivider />
      <GoogleButton next={next} onError={setError} label="Sign up with Google" />

      {/* What a new account can and cannot do, before they ask an admin. */}
      <p className="m-dim-2 mt-7 flex items-start gap-2.5 rounded-xl border border-[var(--m-line)] bg-white/[0.02] px-3.5 py-3 text-[12px] leading-relaxed">
        <LogoMark id="signup-note-mark" className="mt-px size-4 shrink-0" />
        <span>
          You will start as a <span className="font-semibold text-[var(--m-ink)]">Member</span> and
          can raise vouchers immediately. Approving them is granted separately by an administrator.
        </span>
      </p>

      <p className="m-dim mt-7 text-center text-[13.5px]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton fields={3} />}>
      <SignupForm />
    </Suspense>
  );
}

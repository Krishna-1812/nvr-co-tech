'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Mail, MailCheck, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthError, AuthSubmit, GoogleButton, OrDivider } from '@/components/auth/AuthBits';
import { AuthCard, AuthHeading } from '@/components/auth/AuthCard';
import { AuthField, AuthInput, AuthPassword } from '@/components/auth/AuthField';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
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
          ? 'There is already an account with that email. Try signing in instead.'
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
      <div className="animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
        <AuthHeading
          title={
            <>
              Check your <span className="m-serif m-grad-text">inbox.</span>
            </>
          }
        />
        <AuthCard
          footer={
            <Link
              href="/login"
              className="text-[13px] font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
            >
              Back to sign in
            </Link>
          }
        >
          <div className="py-2 text-center">
            <span
              className="mx-auto grid size-14 place-items-center rounded-2xl text-white"
              style={{
                backgroundImage: 'var(--m-grad)',
                boxShadow: '0 12px 34px oklch(0.64 0.18 274 / 0.4)',
              }}
            >
              <MailCheck className="size-7" aria-hidden />
            </span>
            <p className="m-dim mt-6 text-[14px] leading-relaxed">
              We have sent a link to{' '}
              <span className="font-semibold text-[var(--m-ink)]">{email}</span>. Open it and your
              account is ready.
            </p>
            <p className="m-dim-2 mt-5 text-[12px] leading-relaxed">
              You start off as a <span className="font-semibold text-[var(--m-ink)]">Member</span>,
              so you can raise vouchers right away.
            </p>
          </div>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <AuthHeading
        title={
          <>
            Create your <span className="m-serif m-grad-text">account.</span>
          </>
        }
        lead="It takes about a minute, and you can raise your first voucher straight after."
      />

      <AuthCard
        footer={
          <p className="m-dim text-[13px]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-[var(--m-ink)] underline-offset-4 transition hover:text-[var(--m-cyan)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <AuthField
            label="Full name"
            htmlFor="full_name"
            hint="This is the name that appears on vouchers you raise."
          >
            <AuthInput
              id="full_name"
              icon={User}
              autoComplete="name"
              placeholder="Your name"
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
            hint={`Use at least ${MIN_PASSWORD} characters.`}
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

        {/* What a new account can do before anyone has to grant it anything. */}
        <p className="m-dim-2 mt-6 text-center text-[12px] leading-relaxed">
          New accounts start as a <span className="font-semibold text-[var(--m-ink)]">Member</span>,
          so you can raise vouchers straight away. Being able to approve them is something an
          administrator gives you.
        </p>
      </AuthCard>
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

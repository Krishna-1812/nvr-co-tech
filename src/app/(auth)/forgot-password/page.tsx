'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthError, AuthSubmit } from '@/components/auth/AuthBits';
import { AuthCard, AuthHeading } from '@/components/auth/AuthCard';
import { AuthField, AuthInput } from '@/components/auth/AuthField';

/**
 * Request a password-reset link.
 *
 * There was no self-service recovery path at all before this: a forgotten
 * password meant emailing the vendor directly, which does not scale past one
 * hand-held client. This is the missing half of /reset-password — that page
 * is where the emailed link actually lands.
 *
 * Always shows "check your inbox" once submitted, whether or not the address
 * has an account. Supabase's own resetPasswordForEmail already behaves this
 * way for a good reason: a form that says "no account with that email" is a
 * way to find out which emails have accounts here.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    });

    setBusy(false);
    // A real failure here is something like the auth server being unreachable,
    // not "no such account" — Supabase already swallows that case itself.
    if (error) {
      setError('Could not send that right now. Please try again in a moment.');
      return;
    }
    setSent(true);
  };

  if (sent) {
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
              If <span className="font-semibold text-[var(--m-ink)]">{email}</span> has an
              account, a link to set a new password is on its way.
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
            Reset your <span className="m-serif m-grad-text">password.</span>
          </>
        }
        lead="Tell us the email on the account, and we will send a link to set a new one."
      />

      <AuthCard
        footer={
          <p className="m-dim text-[13px]">
            Remembered it after all?{' '}
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

          <AuthError message={error} />

          <div className="pt-1">
            <AuthSubmit loading={busy}>
              Send reset link
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </AuthSubmit>
          </div>
        </form>
      </AuthCard>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthError, AuthSubmit } from '@/components/auth/AuthBits';
import { AuthCard, AuthHeading } from '@/components/auth/AuthCard';
import { AuthField, AuthPassword } from '@/components/auth/AuthField';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import { AFTER_LOGIN } from '@/lib/routes';

const MIN_PASSWORD = 8;

/**
 * Where a password-reset email actually lands, after /auth/callback has
 * already exchanged the emailed link's code for a session — the same
 * exchange every sign-in link on this site goes through, so nothing here has
 * to speak the recovery flow's own protocol.
 *
 * A session existing is not proof it is a *recovery* session — someone could
 * be signed in already and stumble onto this URL — but updateUser only ever
 * changes the current session's own account, so there is nothing to exploit
 * either way: at worst a signed-in person sets their own password again.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<'checking' | 'ready' | 'no-session'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setReady(data.session ? 'ready' : 'no-session');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD) {
      setError(`Please use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }

    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setError('Could not set that password. Please try again.');
      return;
    }
    setDone(true);
  };

  if (ready === 'checking') {
    return <AuthFormSkeleton fields={2} />;
  }

  if (ready === 'no-session') {
    return (
      <div className="animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
        <AuthHeading
          title={
            <>
              That link has <span className="m-serif m-grad-text">expired.</span>
            </>
          }
          lead="Password reset links only work once, and only for a little while."
        />
        <AuthCard>
          <Link
            href="/forgot-password"
            className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[14px] font-semibold text-white transition hover:brightness-110"
            style={{
              backgroundImage: 'var(--m-grad)',
              boxShadow: '0 10px 30px oklch(0.64 0.18 274 / 0.35)',
            }}
          >
            Send a new link
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </AuthCard>
      </div>
    );
  }

  if (done) {
    return (
      <div className="animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
        <AuthHeading
          title={
            <>
              Password <span className="m-serif m-grad-text">updated.</span>
            </>
          }
        />
        <AuthCard>
          <button
            type="button"
            onClick={() => {
              router.push(AFTER_LOGIN);
              router.refresh();
            }}
            className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[14px] font-semibold text-white transition hover:brightness-110"
            style={{
              backgroundImage: 'var(--m-grad)',
              boxShadow: '0 10px 30px oklch(0.64 0.18 274 / 0.35)',
            }}
          >
            <Check className="size-4" aria-hidden />
            Continue
          </button>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className="animate-[rise_0.65s_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <AuthHeading
        title={
          <>
            Set a new <span className="m-serif m-grad-text">password.</span>
          </>
        }
      />

      <AuthCard>
        <form onSubmit={submit} className="space-y-4">
          <AuthField label="New password" htmlFor="password" hint={`Use at least ${MIN_PASSWORD} characters.`}>
            <AuthPassword
              id="password"
              icon={Lock}
              autoComplete="new-password"
              placeholder="Choose a password"
              required
              autoFocus
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </AuthField>

          <AuthField label="Confirm password" htmlFor="confirm">
            <AuthPassword
              id="confirm"
              icon={Lock}
              autoComplete="new-password"
              placeholder="Type it again"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </AuthField>

          <AuthError message={error} />

          <div className="pt-1">
            <AuthSubmit loading={busy}>
              Set password
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </AuthSubmit>
          </div>
        </form>
      </AuthCard>
    </div>
  );
}

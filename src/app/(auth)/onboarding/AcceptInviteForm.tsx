'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { acceptInvite } from '@/app/actions/onboarding';
import { AuthError, AuthSubmit } from '@/components/auth/AuthBits';
import { AuthCard } from '@/components/auth/AuthCard';

/** "23 August 2026", in the reader's own locale-independent order. */
function expiryLabel(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function AcceptInviteForm({
  token,
  expiresAt,
}: {
  token: string;
  expiresAt?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const expiry = expiresAt ? expiryLabel(expiresAt) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    const res = await acceptInvite(token);
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }

    router.push('/hub');
    router.refresh();
  };

  return (
    <AuthCard>
      <form onSubmit={submit} className="space-y-4">
        <AuthError message={error} />
        <AuthSubmit loading={busy}>
          Join organisation
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </AuthSubmit>

        {/* Invites last fourteen days, which nothing used to say anywhere. */}
        {expiry && (
          <p className="m-dim-2 text-center text-[12px] leading-relaxed">
            This link works until {expiry}.
          </p>
        )}
      </form>
    </AuthCard>
  );
}

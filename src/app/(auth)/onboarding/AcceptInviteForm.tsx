'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { acceptInvite } from '@/app/actions/onboarding';
import { AuthError, AuthSubmit } from '@/components/auth/AuthBits';
import { AuthCard } from '@/components/auth/AuthCard';

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      </form>
    </AuthCard>
  );
}

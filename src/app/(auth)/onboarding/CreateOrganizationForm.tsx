'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2 } from 'lucide-react';
import { createOrganization } from '@/app/actions/onboarding';
import { AuthError, AuthSubmit } from '@/components/auth/AuthBits';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthField, AuthInput } from '@/components/auth/AuthField';

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    const res = await createOrganization(name);
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
        <AuthField
          label="Organisation name"
          htmlFor="org_name"
          hint="You can change this later from Settings."
        >
          <AuthInput
            id="org_name"
            icon={Building2}
            placeholder="Your company or team name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </AuthField>

        <AuthError message={error} />

        <div className="pt-1">
          <AuthSubmit loading={busy} disabled={!name.trim()}>
            Create organisation
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </AuthSubmit>
        </div>
      </form>

      <p className="m-dim-2 mt-6 text-center text-[12px] leading-relaxed">
        You will be its first owner, able to invite your team and manage chapters afterward.
      </p>
    </AuthCard>
  );
}

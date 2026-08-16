'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AtSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardTitle, Field, Input } from '@/components/ui/primitives';

/**
 * Change your own sign-in email.
 *
 * Supabase does the actual work: a confirmation link goes out (to the new
 * address, and — unless "Secure email change" is off in the project's auth
 * settings — the old one too), and the email only changes once that link is
 * followed. The link lands on /auth/callback, the same code-exchange route
 * every sign-in link on this site already goes through, so nothing new was
 * needed there.
 */
export function ChangeEmailForm({ email }: { email: string }) {
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const { error } = await createClient().auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings')}` },
    );
    setBusy(false);

    if (error) {
      toast.error('Could not start that change. Please try again.');
      return;
    }
    setSent(true);
  };

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<AtSign className="size-4" />}
        title="Change email"
        description={`Currently ${email}.`}
      />
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 px-5 py-4">
        <div className="min-w-[14rem] flex-1">
          <Field label="New email" htmlFor="new_email">
            <Input
              id="new_email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@thefinanceintelligence.com"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" variant="primary" loading={busy} disabled={!next.trim()}>
          Send confirmation
        </Button>
      </form>
      {sent && (
        <p className="text-subtle border-t px-5 py-3 text-sm">
          Check your inbox — the email only changes once you confirm it.
        </p>
      )}
    </Card>
  );
}

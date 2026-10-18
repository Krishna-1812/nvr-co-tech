'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardTitle, Field, Input } from '@/components/ui/primitives';

const MIN_PASSWORD = 8;

/**
 * Change your own password.
 *
 * Before this there was no way to do so at all — a bad or leaked password was
 * permanent. `updateUser` alone would work with nothing but the current
 * session, but that means anyone at an unattended, still-signed-in browser
 * could lock the real owner out. Asking for the current password first is a
 * client-side re-check on top of that, cheap insurance for what it costs.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty = current.length > 0 && next.length > 0 && confirm.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (next.length < MIN_PASSWORD) {
      toast.error(`Please use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (next !== confirm) {
      toast.error('Those two passwords do not match.');
      return;
    }

    setBusy(true);
    const supabase = createClient();

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauthError) {
      setBusy(false);
      toast.error('That is not your current password.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);

    if (error) {
      toast.error('Could not change your password. Please try again.');
      return;
    }

    toast.success('Password changed.');
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<KeyRound className="size-4" />}
        title="Change password"
        description="You will need your current one first."
      />
      <form onSubmit={submit} className="space-y-4 px-5 py-4">
        <Field label="Current password" htmlFor="current_password">
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="new_password" hint={`At least ${MIN_PASSWORD} characters.`}>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm_password">
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/primitives';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <Button onClick={signOut} loading={busy}>
      {!busy && <LogOut className="size-4" aria-hidden />}
      Sign out
    </Button>
  );
}

/**
 * Ends every session on every device, not just this browser — the thing to
 * reach for after a lost laptop or a password that might have leaked, where
 * "sign out" on the device in hand does nothing for the one you cannot get
 * to. `scope: 'global'` revokes the refresh token itself, so a session that
 * is merely still open elsewhere stops working next time it tries to renew.
 */
export function SignOutEverywhereButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOutEverywhere = async () => {
    setBusy(true);
    const { error } = await createClient().auth.signOut({ scope: 'global' });
    if (error) {
      setBusy(false);
      toast.error('Could not sign out other devices. Please try again.');
      return;
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <Button onClick={signOutEverywhere} loading={busy}>
      {!busy && <ShieldOff className="size-4" aria-hidden />}
      Sign out everywhere
    </Button>
  );
}

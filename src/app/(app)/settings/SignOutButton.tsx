'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
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

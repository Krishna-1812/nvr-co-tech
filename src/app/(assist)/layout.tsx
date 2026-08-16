import { requireOrgMember } from '@/lib/supabase/server';
import { assistSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/**
 * The assistant with a screen to itself.
 *
 * Its own route group for the same reason the other tools have one: (app) is
 * Voucher Desk and carries a rail of voucher destinations, a queue badge and a
 * New voucher button, none of which belong beside a conversation. All three
 * groups render the same AppShell and differ only in the Section they hand it.
 */
export default async function AssistLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOrgMember();

  return (
    <AppShell user={user} section={assistSection()}>
      {children}
    </AppShell>
  );
}

import { requireUser, getViewer } from '@/lib/supabase/server';
import { accountSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/**
 * Your account, on its own.
 *
 * Settings used to sit under (app), inside Voucher Desk's shell, which was
 * harmless while every signed-in person had Voucher Desk. Since the workspace
 * opened, most signed-in people do not (lib/access), and their account screen
 * cannot live inside a tool that is locked to them.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { admin } = await getViewer();
  return (
    <AppShell user={user} admin={admin} section={accountSection()}>
      {children}
    </AppShell>
  );
}

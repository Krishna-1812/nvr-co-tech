import { ScrollText } from 'lucide-react';
import { getViewer, requireUser } from '@/lib/supabase/server';
import { canUseTool } from '@/lib/access';
import { lockedSection, noticesSection } from '@/lib/nav';
import { LockedTool } from '@/components/access/LockedTool';
import { Card, EmptyState } from '@/components/ui/primitives';
import { analyticsGate } from '@/lib/analytics/admin';
import { AppShell } from '@/components/AppShell';
import { NotInstalled } from '@/components/analytics/NotInstalled';

/**
 * Tax Notice Watch, and the gate in front of it.
 *
 * The same shape as Contact Finder's: anybody who is not a platform admin sees
 * the tool described and may ask for it (lib/access). An admin then needs to be
 * on `analytics_admins` as well, because that is what the tables of migration
 * 0037 check before they hand over a single row; an admin by the code list
 * alone would get an empty screen, so they are told the one step instead.
 *
 * Like next door, this layout is not the real enforcement: every table and the
 * file bucket ask `is_analytics_admin()` in Postgres themselves.
 */
export default async function NoticesLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!canUseTool('tax-notices', viewer.admin, viewer.grants)) {
    return (
      <AppShell user={viewer.user} section={lockedSection('tax-notices', 'Tax Notice Watch', '/tax-notices', ScrollText)}>
        <LockedTool slug="tax-notices" signedIn={!!viewer.user} name={viewer.user?.full_name} email={viewer.user?.authEmail} />
      </AppShell>
    );
  }
  const user = await requireUser();
  const gate = await analyticsGate();

  return (
    <AppShell user={user} admin section={noticesSection()}>
      {gate.allowed ? (
        children
      ) : gate.reason === 'not-installed' ? (
        <NotInstalled />
      ) : (
        <Card className="overflow-hidden">
          <EmptyState
            icon={<ScrollText className="size-6" />}
            title="One step left to switch this on for you"
            description="The notices are kept for the platform's admin list inside the database, and your address is not on it yet. Add it under Admin settings, or run migration 0032."
          />
        </Card>
      )}
    </AppShell>
  );
}

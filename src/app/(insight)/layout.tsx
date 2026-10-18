import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { analyticsSection } from '@/lib/nav';
import { analyticsGate } from '@/lib/analytics/admin';
import { AppShell } from '@/components/AppShell';
import { NotInstalled } from '@/components/analytics/NotInstalled';

/**
 * The Admin screen, and the gate in front of it.
 *
 * Checked here rather than on the page so that a screen added later cannot
 * forget it. The list is `analytics_admins` (the owner's admins, 0010 and
 * 0032), asked of Postgres through `is_analytics_admin()`.
 *
 * `notFound()` rather than a redirect for somebody signed in but not on the
 * list: nothing should tell them the screen exists.
 *
 * The real enforcement is not here anyway. Every table the screen reads has a
 * select policy calling the same function (0033), so a person who got past
 * this layout would still be handed nothing.
 */
export default async function InsightLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const gate = await analyticsGate();

  if (!gate.allowed && gate.reason === 'not-admin') notFound();

  return (
    <AppShell user={user} section={analyticsSection()}>
      {gate.allowed ? children : <NotInstalled />}
    </AppShell>
  );
}

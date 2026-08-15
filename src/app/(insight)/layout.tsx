import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { analyticsSection } from '@/lib/nav';
import { analyticsGate } from '@/lib/analytics/admin';
import { AppShell } from '@/components/AppShell';
import { NotInstalled } from '@/components/analytics/NotInstalled';

/**
 * Visitor Intelligence, and the gate in front of it.
 *
 * The check is here rather than on each page so that a screen added later
 * cannot forget it, which is the same reasoning as /admin — but the list being
 * checked is a different one, and that is the point of this whole route group
 * being separate. Voucher Desk's admin can approve payments and manage people.
 * That is no reason at all to show them which companies read the pricing page.
 *
 * `notFound()` rather than a redirect for somebody who is signed in but not on
 * the list: a redirect from /analytics tells them there is an /analytics.
 *
 * The real enforcement is not here anyway. Every table these screens read has a
 * select policy calling the same `is_analytics_admin()` this does, so a person
 * who got past this layout would still be handed nothing.
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

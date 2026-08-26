import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { finderSection } from '@/lib/nav';
import { analyticsGate } from '@/lib/analytics/admin';
import { AppShell } from '@/components/AppShell';
import { NotInstalled } from '@/components/analytics/NotInstalled';

/**
 * Contact Finder, and the gate in front of it.
 *
 * The same shape as Visitor Intelligence next door, checked in the layout rather
 * than on each page so a screen added later cannot forget it. The list is the
 * same one, and that is deliberate: what both groups have in common is that they
 * spend or expose something belonging to the platform rather than to a tenant.
 * Here it is money. A search that describes a page of employers draws on one
 * Apollo key funding the whole platform, so "may this person run it" cannot be
 * answered from a role inside somebody's own organisation.
 *
 * `requireUser` rather than `requireOrgMember`, again as next door: nothing on
 * these screens is scoped to an organisation, so belonging to one is not a
 * condition of reading them.
 *
 * `notFound()` for somebody signed in but not on the list, for the same reason:
 * a redirect from /contacts tells them there is a /contacts.
 *
 * As next door, this layout is not the real enforcement. Every route handler
 * behind it asks the same Postgres function again before it touches Apollo,
 * because a layout guards a screen and what needs guarding is the spending.
 */
export default async function FinderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const gate = await analyticsGate();

  if (!gate.allowed && gate.reason === 'not-admin') notFound();

  return (
    <AppShell user={user} section={finderSection()}>
      {gate.allowed ? children : <NotInstalled />}
    </AppShell>
  );
}

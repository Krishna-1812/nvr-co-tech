import { UserSearch } from 'lucide-react';
import { getViewer, requireUser } from '@/lib/supabase/server';
import { canUseTool } from '@/lib/access';
import { finderSection, lockedSection } from '@/lib/nav';
import { LockedTool } from '@/components/access/LockedTool';
import { Card, EmptyState } from '@/components/ui/primitives';
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
  /*
   * Since the workspace opened, Contact Finder is on the roster like the
   * others, so there is nothing left to hide by answering 404: anybody who is
   * not an admin sees the tool described and asks for it (lib/access).
   */
  const viewer = await getViewer();
  if (!canUseTool('contact-finder', viewer.admin, viewer.grants)) {
    return (
      <AppShell user={viewer.user} section={lockedSection('contact-finder', 'Contact Finder', '/contacts', UserSearch)}>
        <LockedTool slug="contact-finder" signedIn={!!viewer.user} name={viewer.user?.full_name} email={viewer.user?.authEmail} />
      </AppShell>
    );
  }
  const user = await requireUser();
  const gate = await analyticsGate();

  return (
    <AppShell user={user} admin section={finderSection()}>
      {gate.allowed ? (
        children
      ) : gate.reason === 'not-installed' ? (
        <NotInstalled />
      ) : (
        // An admin by the code list (lib/access) whose address is not yet in
        // analytics_admins. The searches are guarded inside Postgres by that
        // table, so the screen would only fail; migration 0032 adds the owner's
        // five addresses.
        <Card className="overflow-hidden">
          <EmptyState
            icon={<UserSearch className="size-6" />}
            title="One step left to switch this on for you"
            description="Contact Finder checks the platform's admin list inside the database before it spends a credit, and your address is not on it yet. Running migration 0032 adds it."
          />
        </Card>
      )}
    </AppShell>
  );
}

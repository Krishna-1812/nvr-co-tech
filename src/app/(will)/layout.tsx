import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/supabase/server';
import { willSection } from '@/lib/nav';
import { willMakerOpen } from '@/lib/will/flag';
import { AppShell } from '@/components/AppShell';

/**
 * Will Maker.
 *
 * Its own route group so the shared shell is handed this tool's Section. Not
 * yet public: `willMakerOpen` lets admins in and turns everybody else away
 * with the ordinary not-found page, before the shell or anything else renders.
 */
export default async function WillLayout({ children }: { children: React.ReactNode }) {
  const { user, admin } = await getViewer();
  if (!willMakerOpen(admin)) notFound();

  return (
    <AppShell user={user} admin={admin} section={willSection()}>
      {children}
    </AppShell>
  );
}

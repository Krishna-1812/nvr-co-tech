import { redirect } from 'next/navigation';
import { Building2, Trash2, Users } from 'lucide-react';
import { requireUser } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/domain/workflow';
import { NavLink } from '@/components/NavLink';
import { PageHeader } from '@/components/PageHeader';

/**
 * Everything under /admin requires an admin. The check lives here rather than on
 * each page so a new admin screen cannot forget it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect('/dashboard');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="People, chapters and the bin"
        description="Who can do what, which chapters vouchers can be raised against, and anything that has been deleted."
        rule={false}
        className="pb-0"
      />

      {/* Pulled up against the header so the tabs read as part of the title block
          rather than as a second bar under it. */}
      <nav className="-mt-2 flex gap-1 border-b" aria-label="Admin sections">
        <NavLink href="/admin" exact variant="tab">
          <Users className="size-4" aria-hidden />
          People
        </NavLink>
        <NavLink href="/admin/chapters" variant="tab">
          <Building2 className="size-4" aria-hidden />
          Chapters
        </NavLink>
        <NavLink href="/admin/deleted" variant="tab">
          <Trash2 className="size-4" aria-hidden />
          Deleted
        </NavLink>
      </nav>

      {children}
    </div>
  );
}

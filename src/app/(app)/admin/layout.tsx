import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/domain/workflow';
import { NavLink } from '@/components/NavLink';
import { PageHeader } from '@/components/PageHeader';

/**
 * Everything under /admin requires an admin. The check lives here rather than
 * on each page so a new admin screen cannot forget it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect('/dashboard');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NVR Intelligence"
        title="Administration"
        description="People, chapters, and vouchers that have been deleted."
      />

      <nav className="flex gap-1 border-b" aria-label="Admin sections">
        <NavLink href="/admin" exact variant="tab">
          People
        </NavLink>
        <NavLink href="/admin/chapters" variant="tab">
          Chapters
        </NavLink>
        <NavLink href="/admin/deleted" variant="tab">
          Deleted
        </NavLink>
      </nav>

      {children}
    </div>
  );
}

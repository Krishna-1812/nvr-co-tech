import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/domain/workflow';
import { NavLink } from '@/components/NavLink';

/**
 * Everything under /admin requires an admin. The check lives here rather than
 * on each page so a new admin screen cannot forget it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect('/');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted mt-1 text-sm">
          People, chapters, and vouchers that have been deleted.
        </p>
      </div>

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

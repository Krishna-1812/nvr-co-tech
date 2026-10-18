import type { Metadata } from 'next';
import { getViewer } from '@/lib/supabase/server';
import { LandedWorkbench } from '@/components/landed/LandedWorkbench';
import { LandedSave } from '@/components/access/ToolSave';

export const metadata: Metadata = { title: 'True Property Cost' };

/**
 * The tool. A server page holding client components, because there is nothing
 * for the server to fetch: the schedules live in the reader's browser. Who is
 * signed in decides only whose schedules they are (none, for a visitor, who
 * may use the whole tool without an account — lib/access).
 */
export default async function LandedCostPage() {
  const { user } = await getViewer();
  return (
    <div className="space-y-4">
      <LandedSave userId={user?.id ?? null} />
      <LandedWorkbench userId={user?.id ?? null} />
    </div>
  );
}

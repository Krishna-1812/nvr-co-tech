import { requireUser, createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/primitives';
import { ChaptersManager, type AdminChapter } from './ChaptersManager';

export const metadata = { title: 'Chapters' };

/**
 * Chapters.
 *
 * v1 hard-coded the 15 CIO Association chapters into the JS bundle, so adding
 * or retiring one meant a redeploy. They are rows now, and this is where HO
 * manages them.
 */
export default async function AdminChaptersPage() {
  await requireUser();
  const supabase = await createClient();

  const [{ data: chapters }, { data: vouchers }] = await Promise.all([
    supabase.from('chapters').select('*').order('name'),
    supabase.from('vouchers').select('chapter_id').is('deleted_at', null),
  ]);

  // Usage counts, so an admin can see what retiring a chapter would affect.
  const usage = new Map<string, number>();
  for (const v of (vouchers ?? []) as { chapter_id: string | null }[]) {
    if (v.chapter_id) usage.set(v.chapter_id, (usage.get(v.chapter_id) ?? 0) + 1);
  }

  const rows = ((chapters ?? []) as AdminChapter[]).map((c) => ({
    ...c,
    voucherCount: usage.get(c.id) ?? 0,
  }));

  return (
    <Card className="overflow-hidden">
      <ChaptersManager chapters={rows} />
    </Card>
  );
}

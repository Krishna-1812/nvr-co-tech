import { requireUser, createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/primitives';
import { HeroStat } from '@/components/ui/ToolHero';
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

  /*
   * The strip above the list. Counted from the rows already read; the busiest
   * chapter is named because "where does the money go" is the question an
   * admin opening this screen is most often half-asking.
   */
  const active = rows.filter((c) => c.is_active).length;
  const raised = rows.reduce((s, c) => s + c.voucherCount, 0);
  const busiest = rows.reduce<(typeof rows)[number] | null>(
    (top, c) => (c.voucherCount > (top?.voucherCount ?? 0) ? c : top),
    null,
  );
  // A tie is reported as a tie: naming the first of four equal chapters
  // "busiest" would be a claim the numbers do not make.
  const tied = busiest ? rows.filter((c) => c.voucherCount === busiest.voucherCount).length : 0;

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <HeroStat label="Chapters" value={rows.length} note={`${active} open for new vouchers`} />
          <HeroStat
            label="Retired"
            value={rows.length - active}
            note={rows.length - active === 0 ? 'None retired' : 'Kept for their history'}
          />
          <HeroStat label="Vouchers raised" value={raised} note="Across every chapter" />
          <HeroStat
            label="Busiest"
            value={!busiest ? '—' : tied > 1 ? `${tied} tied` : busiest.code}
            note={
              busiest && tied > 1
                ? `${busiest.voucherCount} ${busiest.voucherCount === 1 ? 'voucher' : 'vouchers'} each`
                : busiest
                  ? `${busiest.name}, ${busiest.voucherCount} ${busiest.voucherCount === 1 ? 'voucher' : 'vouchers'}`
                  : 'No vouchers yet'
            }
          />
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <ChaptersManager chapters={rows} />
      </Card>
    </div>
  );
}

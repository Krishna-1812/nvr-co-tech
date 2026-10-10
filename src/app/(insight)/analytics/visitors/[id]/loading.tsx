import { HeaderSkeleton, StatsSkeleton, TableSkeleton } from '@/components/ui/Skeletons';

/**
 * The analytics sub-pages open with their header and a summary strip rather
 * than the overview's hero. Without a loading screen of their own they
 * inherited the overview's, so the hero's arch flashed up and was replaced by
 * a plain header; this holds the shape that is actually coming.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton withAction={false} />
      <StatsSkeleton count={4} />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

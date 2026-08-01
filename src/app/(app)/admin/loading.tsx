import { TableSkeleton } from '@/components/ui/Skeletons';

/**
 * Sits inside the admin layout, so the tab bar stays put while the table under
 * it loads — only the changing part is replaced.
 */
export default function AdminLoading() {
  return <TableSkeleton rows={8} columns={5} />;
}

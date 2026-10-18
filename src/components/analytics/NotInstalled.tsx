import { Database } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/primitives';
import { FIRST_ADMIN } from '@/lib/analytics/admin';

/**
 * What this screen says before migration 0010 has been applied.
 *
 * A separate state from "you are not an admin", and worth the extra branch: the
 * two need completely different things done about them, and only one of them is
 * about the person reading. Collapsing both into a blank page produces the worst
 * possible bug report, which is "the analytics do not work".
 */
export function NotInstalled() {
  return (
    <Card className="overflow-hidden">
      <EmptyState
        icon={<Database className="size-6" />}
        title="The Admin tables are not in this database yet"
        description={
          `Migration 0010 creates the admin list, and 0033 the visitor and page tables this `
          + `screen reads. Run them against this project, and ${FIRST_ADMIN} and the other `
          + `admins will be able to open it. Nothing else in the platform is affected.`
        }
      />
    </Card>
  );
}

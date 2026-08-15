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
        title="The analytics tables are not in this database yet"
        description={
          `Migration 0010 creates them, together with the allowlist that decides who may read them. `
          + `Run supabase/migrations/0010_analytics.sql against this project, and ${FIRST_ADMIN} `
          + `will be able to open these screens. Nothing is being collected until it is applied, `
          + `and nothing else in the platform is affected.`
        }
      />
    </Card>
  );
}

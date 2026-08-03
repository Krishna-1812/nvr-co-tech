import { FlaskConical } from 'lucide-react';

/**
 * Sample-data warning. Loud on purpose: in preview mode the approval rules are
 * being checked by this browser rather than by Postgres, and anyone shown a demo
 * needs to know that nothing they see was actually enforced.
 *
 * Its own file because there are now two signed-in shells — the hub and Voucher
 * Desk — and a warning that appears in one of them and not the other would be
 * worse than no warning at all.
 */
export function PreviewBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        Preview — sample data, no database. Approvals here are checked by the browser, not by
        Postgres.
      </span>
    </div>
  );
}

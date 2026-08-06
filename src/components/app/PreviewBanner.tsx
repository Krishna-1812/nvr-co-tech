import { FlaskConical } from 'lucide-react';

/**
 * Sample-data warning. Loud on purpose: in preview mode every rule this platform
 * relies on is being checked by the browser rather than by Postgres, and anyone
 * being shown a demo needs to know that nothing they see was actually enforced.
 *
 * The wording is about rules in general rather than about approvals in
 * particular, because it now appears above three shells: the workspace, Voucher
 * Desk and Ledger Reconciliation. Its own file for the same reason — a warning
 * that appears in one shell and not another is worse than no warning at all.
 */
export function PreviewBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        Preview — sample data, no database. Every rule here is checked by the browser, not by
        Postgres.
      </span>
    </div>
  );
}

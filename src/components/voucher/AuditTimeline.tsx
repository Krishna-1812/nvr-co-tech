import {
  FilePlus,
  Send,
  Check,
  CheckCheck,
  X,
  RotateCcw,
  Wallet,
  Trash2,
  Pencil,
} from 'lucide-react';
import type { AuditAction } from '@/lib/supabase/types';
import { relativeTime } from '@/lib/utils';
import { fmtDate } from '@/lib/domain/voucher';

type Entry = {
  id: number;
  action: AuditAction;
  note: string | null;
  created_at: string;
  actor?: { full_name: string | null; email: string } | null;
};

const ACTION_META: Record<AuditAction, { icon: typeof Check; label: string; tone: string }> = {
  created: { icon: FilePlus, label: 'Created', tone: 'text-[var(--text-muted)]' },
  updated: { icon: Pencil, label: 'Edited', tone: 'text-[var(--text-muted)]' },
  submitted: { icon: Send, label: 'Submitted for approval', tone: 'text-blue-600 dark:text-blue-400' },
  approved_first: { icon: Check, label: 'First approval given', tone: 'text-emerald-600 dark:text-emerald-400' },
  approved_second: { icon: CheckCheck, label: 'Second approval given', tone: 'text-emerald-600 dark:text-emerald-400' },
  rejected: { icon: X, label: 'Sent back', tone: 'text-red-600 dark:text-red-400' },
  reopened: { icon: RotateCcw, label: 'Reopened', tone: 'text-amber-600 dark:text-amber-400' },
  marked_paid: { icon: Wallet, label: 'Marked paid', tone: 'text-teal-600 dark:text-teal-400' },
  deleted: { icon: Trash2, label: 'Deleted', tone: 'text-red-600 dark:text-red-400' },
  restored: { icon: RotateCcw, label: 'Restored', tone: 'text-[var(--text-muted)]' },
  purged: { icon: Trash2, label: 'Permanently deleted', tone: 'text-red-600 dark:text-red-400' },
};

/**
 * The audit trail — the thing that makes a voucher defensible.
 *
 * v1 had no equivalent: approvals were names typed into text boxes, with no
 * record of who did what or when. `voucher_audit` has no UPDATE or DELETE
 * policy, so nothing shown here can be edited after the fact.
 */
export function AuditTimeline({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return <p className="text-subtle p-5 text-sm">No history yet.</p>;
  }

  return (
    <ol className="relative space-y-0 p-5">
      {entries.map((e, i) => {
        const meta = ACTION_META[e.action];
        const last = i === entries.length - 1;
        const who = e.actor?.full_name ?? e.actor?.email ?? 'Someone';

        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector */}
            {!last && (
              <span
                aria-hidden
                className="absolute top-7 bottom-0 left-3 w-px bg-[var(--border-c)]"
              />
            )}

            <span
              className={`surface relative z-10 grid size-6 shrink-0 place-items-center rounded-full ${meta.tone}`}
            >
              <meta.icon className="size-3.5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm">
                <span className="font-medium">{meta.label}</span>
                <span className="text-muted"> by {who}</span>
              </p>
              <p className="text-subtle text-xs">
                <time dateTime={e.created_at} title={new Date(e.created_at).toLocaleString('en-IN')}>
                  {fmtDate(e.created_at)} · {relativeTime(e.created_at)}
                </time>
              </p>
              {e.note && (
                <p className="text-muted mt-1.5 rounded-lg border-l-2 border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                  {e.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

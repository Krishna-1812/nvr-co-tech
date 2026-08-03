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
import type { CSSProperties } from 'react';
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

/**
 * Tones come from the same --status-* tokens the badges use, so an "approved"
 * entry in the history is the identical green to the Approved chip above it —
 * the timeline reads as the story of the status rather than a second palette.
 */
const ACTION_META: Record<AuditAction, { icon: typeof Check; label: string; tone: string }> = {
  created: { icon: FilePlus, label: 'Created', tone: 'var(--status-draft)' },
  updated: { icon: Pencil, label: 'Edited', tone: 'var(--status-draft)' },
  submitted: { icon: Send, label: 'Submitted for approval', tone: 'var(--status-pending)' },
  approved_first: { icon: Check, label: 'First approval given', tone: 'var(--status-approved)' },
  approved_second: {
    icon: CheckCheck,
    label: 'Second approval given',
    tone: 'var(--status-approved)',
  },
  rejected: { icon: X, label: 'Sent back', tone: 'var(--status-rejected)' },
  reopened: { icon: RotateCcw, label: 'Reopened', tone: 'var(--status-draft)' },
  marked_paid: { icon: Wallet, label: 'Marked paid', tone: 'var(--status-paid)' },
  deleted: { icon: Trash2, label: 'Deleted', tone: 'var(--status-rejected)' },
  restored: { icon: RotateCcw, label: 'Restored', tone: 'var(--status-draft)' },
  purged: { icon: Trash2, label: 'Permanently deleted', tone: 'var(--status-rejected)' },
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
    return (
      <p className="text-subtle p-5 text-sm">
        No history yet. Every submission, approval and edit will be recorded here.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 p-5">
      {entries.map((e, i) => {
        const meta = ACTION_META[e.action];
        const last = i === entries.length - 1;
        const who = e.actor?.full_name ?? e.actor?.email ?? 'Someone';

        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/*
              The spine. A gradient from this entry's own tone into the next one's
              rather than a flat grey line, so the timeline reads as one continuous
              thing that changes colour as the voucher changes state.
            */}
            {!last && (
              <span
                aria-hidden
                className="absolute top-7 bottom-0 left-3.5 w-px"
                style={{
                  background: `linear-gradient(180deg, color-mix(in oklab, ${meta.tone} 55%, transparent), var(--border-c))`,
                }}
              />
            )}

            <span
              style={{ '--tone': meta.tone } as CSSProperties}
              className="tinted relative z-10 grid size-7 shrink-0 place-items-center rounded-full border"
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
                  <span className="numeric">{fmtDate(e.created_at)}</span> ·{' '}
                  {relativeTime(e.created_at)}
                </time>
              </p>
              {/* A note is somebody's words, so it is set as a quotation with the
                  entry's own colour on its edge rather than as more body text. */}
              {e.note && (
                <p
                  // The edge colour comes from the entry's own tone, which is a
                  // runtime value and so cannot be a Tailwind class.
                  style={{ borderLeftColor: `color-mix(in oklab, ${meta.tone} 60%, transparent)` }}
                  className="text-muted mt-2.5 rounded-r-lg border-l-2 bg-[var(--surface-sunken)] px-3 py-2 text-sm text-pretty"
                >
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

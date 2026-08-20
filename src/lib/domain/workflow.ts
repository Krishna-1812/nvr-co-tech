/**
 * The approval workflow — statuses, transitions and permissions.
 *
 * This is the part v1 did not have. There, "approvals" were three free-text
 * name boxes typed by whoever created the voucher: no status, no identity, no
 * timestamps, no rejection path, no audit trail. A voucher could be
 * self-approved by typing a colleague's name.
 *
 * The authoritative rules live in Postgres (supabase/migrations/0002_workflow.sql)
 * as SECURITY DEFINER functions, so they hold regardless of client. What is here
 * mirrors them so the UI can grey out actions the server would refuse — never as
 * the only line of defence.
 */

export const VOUCHER_STATUSES = [
  'draft',
  'pending_first',
  'pending_second',
  'approved',
  'rejected',
  'paid',
] as const;

export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export const USER_ROLES = ['member', 'approver', 'admin', 'owner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Role ordering — every role can do what the ones before it can. */
const ROLE_RANK: Record<UserRole, number> = { member: 0, approver: 1, admin: 2, owner: 3 };

export const canApprove = (role: UserRole): boolean => ROLE_RANK[role] >= ROLE_RANK.approver;
export const isAdmin = (role: UserRole): boolean => ROLE_RANK[role] >= ROLE_RANK.admin;
export const isOwner = (role: UserRole): boolean => role === 'owner';

// ─── Presentation ────────────────────────────────────────────────────────────

/**
 * How each role is named and described. One definition, because the account
 * menu, the admin table and the settings screen all show this and had begun to
 * word it differently.
 */
export const ROLE_META: Record<UserRole, { label: string; grants: string }> = {
  member: {
    label: 'Member',
    grants: 'Raises vouchers. Sees only their own.',
  },
  approver: {
    label: 'Approver',
    grants: 'Can approve and send back. Sees the queue.',
  },
  admin: {
    label: 'Admin',
    grants: 'Sees everything, manages chapters, marks vouchers paid.',
  },
  owner: {
    label: 'Owner',
    grants: 'Everything, plus changing roles.',
  },
};

export const STATUS_META: Record<
  VoucherStatus,
  { label: string; description: string; tone: 'neutral' | 'info' | 'warn' | 'success' | 'danger' }
> = {
  draft: {
    label: 'Draft',
    description: 'Being written. Only you can see it.',
    tone: 'neutral',
  },
  pending_first: {
    label: 'Awaiting approval',
    description: 'Submitted and waiting for an approver.',
    tone: 'info',
  },
  /*
   * No organization's submit_voucher() ever puts a voucher here any more
   * (0015) — approval only ever needs one signature now. Kept for any
   * voucher that entered the queue before that shipped and is still
   * waiting on its second, different approver.
   */
  pending_second: {
    label: 'Awaiting 2nd approval',
    description: 'First approval given. Needs a second, different approver.',
    tone: 'info',
  },
  approved: {
    label: 'Approved',
    description: 'Approval given. Locked against edits.',
    tone: 'success',
  },
  rejected: {
    label: 'Sent back',
    description: 'Returned with a reason. Correct it and resubmit.',
    tone: 'danger',
  },
  paid: {
    label: 'Paid',
    description: 'Payment executed and referenced. Final.',
    tone: 'success',
  },
};

/** A voucher's fields can only be edited in these states. */
export const EDITABLE_STATUSES: readonly VoucherStatus[] = ['draft', 'rejected'];

/** These states are waiting on an approver. */
export const PENDING_STATUSES: readonly VoucherStatus[] = ['pending_first', 'pending_second'];

// ─── Permission checks ───────────────────────────────────────────────────────

export type VoucherActor = { id: string; role: UserRole };

export type VoucherLike = {
  status: VoucherStatus;
  created_by: string;
  initiated_by: string | null;
  approver_1: string | null;
  /*
   * Optional because most callers build this from a narrow select that only
   * needed the first approver. canWithdraw() is the one rule that has to know
   * about the second, and treats an absent value the same as a null one — the
   * database check in withdraw_voucher() is the authority either way.
   */
  approver_2?: string | null;
};

export const canEdit = (v: VoucherLike, me: VoucherActor): boolean =>
  EDITABLE_STATUSES.includes(v.status) && (v.created_by === me.id || isAdmin(me.role));

export const canSubmit = (v: VoucherLike, me: VoucherActor): boolean =>
  EDITABLE_STATUSES.includes(v.status) && (v.created_by === me.id || isAdmin(me.role));

/**
 * Segregation of duties, mirroring approve_voucher():
 *   1. you must be an approver, admin or owner
 *   2. the voucher must be awaiting approval
 *   3. you may never approve a voucher you raised
 *   4. the second approver must differ from the first
 */
export function canApproveVoucher(v: VoucherLike, me: VoucherActor): boolean {
  if (!canApprove(me.role)) return false;
  if (!PENDING_STATUSES.includes(v.status)) return false;
  if (v.created_by === me.id || v.initiated_by === me.id) return false;
  if (v.status === 'pending_second' && v.approver_1 === me.id) return false;
  return true;
}

/** Why an approver can't act — so the UI can explain instead of just greying out. */
export function approvalBlockedReason(v: VoucherLike, me: VoucherActor): string | null {
  if (!canApprove(me.role)) return 'You do not have permission to approve vouchers.';
  if (!PENDING_STATUSES.includes(v.status)) return 'This voucher is not awaiting approval.';
  if (v.created_by === me.id || v.initiated_by === me.id) {
    return 'You raised this voucher, so you cannot approve it.';
  }
  if (v.status === 'pending_second' && v.approver_1 === me.id) {
    return 'You gave the first approval — a second person must approve it.';
  }
  return null;
}

export const canReject = canApproveVoucher;

export const canReopen = (v: VoucherLike, me: VoucherActor): boolean => {
  if (v.status === 'rejected') return v.created_by === me.id || isAdmin(me.role);
  if (v.status === 'approved') return isAdmin(me.role);
  return false;
};

export const canMarkPaid = (v: VoucherLike, me: VoucherActor): boolean =>
  v.status === 'approved' && isAdmin(me.role);

/**
 * Take your own voucher back out of the queue, while it is still only yours.
 *
 * Deliberately narrower than canReopen: the raiser only, and only before
 * anybody has given an approval. Once somebody has acted, the record belongs to
 * more than one person — undoing that is a rejection or an admin reopen, both of
 * which require a reason. Not gated on role, because recalling something nobody
 * has looked at is not a privileged act.
 *
 * Mirrors withdraw_voucher() in migration 0021; the database is the authority.
 */
export const canWithdraw = (v: VoucherLike, me: VoucherActor): boolean =>
  (v.status === 'pending_first' || v.status === 'pending_second') &&
  v.created_by === me.id &&
  !v.approver_1 &&
  !v.approver_2;

export const canDelete = (v: VoucherLike, me: VoucherActor): boolean =>
  EDITABLE_STATUSES.includes(v.status) ? v.created_by === me.id || isAdmin(me.role) : isAdmin(me.role);

// ─── Transition map (for display: "what happens next") ───────────────────────

export const NEXT_STATUS: Partial<Record<VoucherStatus, VoucherStatus>> = {
  draft: 'pending_first',
  rejected: 'pending_first',
  pending_first: 'approved',
  pending_second: 'approved',
  approved: 'paid',
};

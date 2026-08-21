import * as fixtures from './fixtures';
import type {
  OperatorMemberRow,
  OperatorOnboardingRow,
  OperatorStuckRow,
  OperatorTenantRow,
  OperatorWorkflowStageRow,
  ProductEventRow,
} from '@/lib/supabase/types';
import type { VoucherStatus } from '@/lib/domain/workflow';

/**
 * The activation half of Visitor Intelligence, for preview mode.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * Three of the seven analytics screens were blank in preview, including the one
 * the rail deliberately puts first. `product_events` arrived in 0022 and the
 * five `operator_*` functions in 0026, and neither got a stand-in, so the
 * overview's four product figures all read 0, the whole activation screen
 * rendered its empty states, and Organisations said "No organisations yet" with
 * an organisation sitting in the fixtures. The same shape of gap as the missing
 * `organization_id`: the newest work has no fixtures, so preview shows the
 * product as it was before that work landed.
 *
 * ── Why the events are derived rather than written ──────────────────────────
 *
 * A hand-written event log would drift from the vouchers beside it within a
 * week, and the drift would be invisible: nothing checks that the voucher the
 * register shows as paid is the voucher activation counts as paid. So the log is
 * computed from the vouchers, the audit trail and the profiles, exactly the way
 * the real triggers compute it from the rows they fire on. The two cannot
 * disagree because there is only one source.
 *
 * These are mirrors of SQL in 0022 and 0026. As everywhere else in preview, they
 * are evidence that the screens render, never evidence that the functions work.
 * Postgres remains the only authority.
 */

// ─── The event log, derived ──────────────────────────────────────────────────

type Voucher = (typeof fixtures.vouchers)[number];
type Audit = (typeof fixtures.voucher_audit)[number];

const APPROVAL_ACTIONS = ['approved_first', 'approved_second'];

/** The audit rows for one voucher, oldest first. */
const trailFor = (id: string): Audit[] =>
  (fixtures.voucher_audit as Audit[])
    .filter((a) => a.voucher_id === id)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

const actedAt = (trail: Audit[], actions: string[]): string | null => {
  const hit = [...trail].reverse().find((a) => actions.includes(String(a.action)));
  return hit ? String(hit.created_at) : null;
};

/**
 * One row per milestone, in the order the triggers would have written them.
 *
 * `skipped_approval` is meta on the paid event rather than an event of its own,
 * which is what 0022 does: it is a property of how that voucher reached paid,
 * not a separate thing that happened.
 */
function buildEvents(): ProductEventRow[] {
  const rows: Omit<ProductEventRow, 'id'>[] = [];
  const org = fixtures.PREVIEW_ORG_ID;

  for (const o of fixtures.organizations) {
    rows.push({
      name: 'organisation_created',
      actor_id: fixtures.PREVIEW_USER_ID,
      organization_id: o.id,
      meta: null,
      created_at: o.created_at,
    });
  }

  for (const p of fixtures.profiles) {
    rows.push({
      name: 'account_created',
      actor_id: p.id,
      // An account is created before it belongs anywhere, which is why the
      // funnel's first step counts people and every later one counts tenants.
      organization_id: null,
      meta: null,
      created_at: p.created_at,
    });
  }

  // The head office every workspace is given does not count as setup.
  for (const c of fixtures.chapters.filter((c) => !c.is_head_office)) {
    rows.push({
      name: 'chapter_created',
      // The chapter fixtures carry no author, and the real trigger records the
      // owner who added one, which in this workspace is the only person who could.
      actor_id: fixtures.PREVIEW_USER_ID,
      organization_id: org,
      meta: null,
      created_at: c.created_at,
    });
  }

  /*
   * Whether a milestone happened is read off the voucher, not off its audit
   * trail, because that is what the real trigger sees: count_voucher_outcome
   * fires on a status change to the vouchers row. Two fixtures are paid without
   * a marked_paid audit entry, and deriving from the trail alone reported one
   * paid voucher on a screen sitting next to a register showing two.
   *
   * The trail is used only for *when*, where it has an answer, because it is the
   * more precise record of that. Otherwise the voucher's own timestamps stand in.
   */
  for (const v of fixtures.vouchers as Voucher[]) {
    if (v.deleted_at) continue;
    const trail = trailFor(v.id);
    const when = (actions: string[], fallback: unknown): string | null =>
      actedAt(trail, actions) ?? (fallback ? String(fallback) : null);

    const submitted = v.submitted_at || v.status !== 'draft'
      ? when(['submitted'], v.submitted_at ?? v.created_at)
      : null;
    const approved =
      v.approver_1 || v.approver_2 || v.status === 'approved' || v.status === 'paid'
        ? when(APPROVAL_ACTIONS, v.approved_1_at ?? v.approved_2_at ?? submitted)
        : null;
    const paid = v.status === 'paid' ? when(['marked_paid'], v.payment_date ?? approved) : null;
    const rejected =
      v.status === 'rejected' || trail.some((a) => String(a.action) === 'rejected')
        ? when(['rejected'], v.submitted_at)
        : null;

    rows.push({
      name: 'voucher_drafted',
      actor_id: v.created_by,
      organization_id: org,
      meta: { voucher: v.id },
      created_at: String(v.created_at),
    });

    if (submitted) {
      rows.push({
        name: 'voucher_submitted',
        actor_id: v.created_by,
        organization_id: org,
        meta: { voucher: v.id, from: 'draft' },
        created_at: submitted,
      });
    }
    if (rejected) {
      rows.push({
        name: 'voucher_rejected',
        actor_id: null,
        organization_id: org,
        meta: { voucher: v.id, from: 'pending_first' },
        created_at: rejected,
      });
    }
    if (approved) {
      rows.push({
        name: 'voucher_approved',
        actor_id: v.approver_1 ?? null,
        organization_id: org,
        meta: { voucher: v.id, from: 'pending_first' },
        created_at: approved,
      });
    }
    if (paid) {
      rows.push({
        name: 'voucher_paid',
        actor_id: null,
        organization_id: org,
        meta: {
          voucher: v.id,
          from: approved ? 'approved' : 'draft',
          skipped_approval: !approved,
        },
        created_at: paid,
      });
    }
  }

  return rows
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((row, i) => ({ ...row, id: i + 1 }));
}

export const product_events: ProductEventRow[] = buildEvents();

// ─── The five functions ──────────────────────────────────────────────────────

const countWhere = (rows: ProductEventRow[], name: string) =>
  rows.filter((e) => e.name === name).length;

export function operatorTenants(): OperatorTenantRow[] {
  return fixtures.organizations
    .map((o) => {
      const mine = product_events.filter((e) => e.organization_id === o.id);
      const times = mine.map((e) => String(e.created_at)).sort();

      return {
        organization_id: o.id,
        name: o.name,
        created_at: o.created_at,
        members: fixtures.profiles.filter((p) => p.organization_id === o.id).length,
        first_event: times[0] ?? null,
        last_event: times[times.length - 1] ?? null,
        chapters_created: countWhere(mine, 'chapter_created'),
        invites_sent: countWhere(mine, 'invite_sent'),
        invites_accepted: countWhere(mine, 'invite_accepted'),
        vouchers_drafted: countWhere(mine, 'voucher_drafted'),
        vouchers_submitted: countWhere(mine, 'voucher_submitted'),
        vouchers_approved: countWhere(mine, 'voucher_approved'),
        vouchers_rejected: countWhere(mine, 'voucher_rejected'),
        vouchers_paid: countWhere(mine, 'voucher_paid'),
        reconciliations_saved: countWhere(mine, 'reconciliation_saved'),
      };
    })
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export function operatorMembers(): OperatorMemberRow[] {
  const named = new Map(fixtures.organizations.map((o) => [o.id, o.name]));

  return fixtures.profiles.map((p) => ({
    email: p.email,
    full_name: p.full_name,
    avatar_url: p.avatar_url ?? null,
    organization_id: p.organization_id ?? null,
    organization_name: p.organization_id ? (named.get(p.organization_id) ?? null) : null,
    joined_at: p.created_at,
  }));
}

export function operatorOnboarding(): OperatorOnboardingRow[] {
  return fixtures.profiles
    .filter((p) => !p.organization_id && p.email)
    .map((p) => ({ email: p.email, full_name: p.full_name, signed_up_at: p.created_at }))
    .sort((a, b) => b.signed_up_at.localeCompare(a.signed_up_at));
}

/** Median and p90, the way percentile_cont does it: interpolated, not nearest. */
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return round(sorted[0]);
  const at = p * (sorted.length - 1);
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return round(sorted[low] + (sorted[high] - sorted[low]) * (at - low));
}

const round = (n: number) => Math.round(n * 10) / 10;

const hoursBetween = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;

export function operatorWorkflowStages(): OperatorWorkflowStageRow[] {
  const spans = new Map<string, number[]>();
  const add = (stage: string, hours: number) => {
    if (!Number.isFinite(hours)) return;
    spans.set(stage, [...(spans.get(stage) ?? []), hours]);
  };

  for (const v of fixtures.vouchers as Voucher[]) {
    const trail = trailFor(v.id);
    if (trail.length === 0) continue;

    const drafted = String(v.created_at);
    const submitted = actedAt(trail, ['submitted']);
    const approved = actedAt(trail, APPROVAL_ACTIONS);
    const paid = actedAt(trail, ['marked_paid']);

    if (submitted) add('Draft to submitted', hoursBetween(drafted, submitted));
    if (approved && submitted) add('Submitted to approved', hoursBetween(submitted, approved));
    if (paid && approved) add('Approved to paid', hoursBetween(approved, paid));
    if (paid && submitted && !approved) {
      add('Submitted to paid, no approval step', hoursBetween(submitted, paid));
    }
  }

  return [...spans.entries()].map(([stage, hours]) => {
    const sorted = [...hours].sort((a, b) => a - b);
    return {
      stage,
      samples: sorted.length,
      median_hours: percentile(sorted, 0.5),
      p90_hours: percentile(sorted, 0.9),
    };
  });
}

const UNSETTLED: VoucherStatus[] = [
  'draft',
  'pending_first',
  'pending_second',
  'approved',
  'rejected',
];

export function operatorStuckVouchers(days = 7): OperatorStuckRow[] {
  const named = new Map(fixtures.organizations.map((o) => [o.id, o.name]));
  const cutoff = Date.now() - Math.max(days, 1) * 86_400_000;
  const groups = new Map<string, OperatorStuckRow>();

  for (const v of fixtures.vouchers as Voucher[]) {
    if (v.deleted_at) continue;
    if (!UNSETTLED.includes(v.status as VoucherStatus)) continue;

    const since = String(v.submitted_at ?? v.created_at);
    const at = new Date(since).getTime();
    if (at >= cutoff) continue;

    const orgId = fixtures.PREVIEW_ORG_ID;
    const key = `${orgId}:${v.status}`;
    const oldest = Math.floor((Date.now() - at) / 86_400_000);
    const found = groups.get(key);

    if (found) {
      found.waiting += 1;
      found.oldest_days = Math.max(found.oldest_days, oldest);
    } else {
      groups.set(key, {
        organization_id: orgId,
        organization_name: named.get(orgId) ?? 'Unknown',
        status: v.status as VoucherStatus,
        waiting: 1,
        oldest_days: oldest,
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) => a.organization_name.localeCompare(b.organization_name) || a.status.localeCompare(b.status),
  );
}

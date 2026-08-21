import type { ProductEventRow } from '@/lib/supabase/types';

/**
 * The activation funnel, out of the events the database records for itself.
 *
 * Pure, and takes its clock as an argument, like the rest of the aggregation
 * layer. Nothing here reads from anywhere.
 *
 * ── Why the funnel is five steps and not seven ──────────────────────────────
 *
 * There are ten event names now, and it is tempting to lay all of them out as a
 * funnel because they arrive in roughly that order. That would be wrong, and
 * wrong in the specific way funnels usually are: a step in a funnel asserts
 * that the step before it was necessary, and a reader looking at a drop between
 * two bars concludes that something failed there.
 *
 * Two of the events do not qualify.
 *
 *   * `chapter_created` fires only for a chapter beyond the head office, and
 *     0021 seeds the head office automatically. So an organisation can draft
 *     and pay a voucher without ever creating one. Shown as a step, its
 *     absence would read as a blockage; it is reported below as setup depth
 *     instead, which is what it actually measures.
 *
 *   * `voucher_approved` never happens at all in an organisation with approval
 *     switched off, because 0013 lets a submitted voucher go straight to paid.
 *     A funnel with an approval step would report those tenants as having
 *     stalled at a stage they were never routed through. So the funnel goes
 *     submitted → paid, and the approval route is reported as a split of the
 *     vouchers that got paid.
 *
 * What is left is five steps that really are sequential: you cannot create a
 * workspace without an account, draft without a workspace, submit without a
 * draft, or be paid without being submitted.
 *
 * ── The two denominators ────────────────────────────────────────────────────
 *
 * The first step counts people and the rest count organisations, because that
 * is what the rows carry: `account_created` is written by the trigger on
 * auth.users, before the person belongs to anything, so its `organization_id`
 * is null by definition. The conversion from step one to step two is therefore
 * "what fraction of the people who signed up went on to start a workspace",
 * which is the most interesting number on the screen and the one that would be
 * lost by forcing both steps onto the same subject.
 */

export type Subject = 'person' | 'organisation';

export type StageSpec = {
  /** The event name in `product_events`. */
  event: string;
  label: string;
  /** What the number is, in one line, on the screen. */
  says: string;
  subject: Subject;
};

export const ACTIVATION: readonly StageSpec[] = [
  {
    event: 'account_created',
    label: 'Signed up',
    subject: 'person',
    says: 'An account exists. Written from the trigger that mints the profile row, so it cannot be missed or double-counted.',
  },
  {
    event: 'organisation_created',
    label: 'Started a workspace',
    subject: 'organisation',
    says: 'Named an organisation and became its owner. Until this happens an account can reach nothing but the onboarding screen.',
  },
  {
    event: 'voucher_drafted',
    label: 'Drafted a voucher',
    subject: 'organisation',
    says: 'Any voucher row inserted, however incomplete. The first act of real work.',
  },
  {
    event: 'voucher_submitted',
    label: 'Submitted one',
    subject: 'organisation',
    says: 'Passed every validation the database enforces and left draft. Counts resubmissions, so it can exceed the drafts.',
  },
  {
    event: 'voucher_paid',
    label: 'Got to paid',
    subject: 'organisation',
    says: 'The end of the workflow, whether it went through an approval or the organisation has approval switched off.',
  },
] as const;

export type Stage = StageSpec & {
  /** How many times it happened. Resubmissions and second vouchers count. */
  occurrences: number;
  /** How many distinct people or organisations ever got this far. */
  reached: number;
  /** Percentage of the previous stage's subjects. Null on the first stage. */
  fromPrevious: number | null;
  /** Percentage of the first stage's subjects. Null on the first stage. */
  fromStart: number | null;
};

const subjectOf = (event: ProductEventRow, subject: Subject): string | null =>
  subject === 'person' ? event.actor_id : event.organization_id;

const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 10;

export function activation(events: ProductEventRow[]): Stage[] {
  const out: Stage[] = [];

  for (const spec of ACTIVATION) {
    const mine = events.filter((e) => e.name === spec.event);

    // Distinct counts only over rows that carry a subject. An event that cannot
    // be attributed is still a thing that happened, so it counts as an
    // occurrence — it just cannot count towards "how many got this far".
    const subjects = new Set(
      mine.map((e) => subjectOf(e, spec.subject)).filter((id): id is string => Boolean(id)),
    );

    const previous = out.at(-1);
    out.push({
      ...spec,
      occurrences: mine.length,
      reached: subjects.size,
      fromPrevious: previous ? pct(subjects.size, previous.reached) : null,
      fromStart: out.length > 0 ? pct(subjects.size, out[0].reached) : null,
    });
  }

  return out;
}

/**
 * Distinct vouchers behind an outcome event.
 *
 * The outcome triggers in 0026 put the voucher id in the meta precisely so this
 * is answerable. It matters because a rejected voucher that is fixed and
 * approved produces one `voucher_rejected` and one `voucher_approved` for the
 * same piece of work — the occurrence count answers "how many approvals were
 * given", this answers "how many vouchers reached approved", and the two are
 * different questions that a single number would confuse.
 */
export function distinctVouchers(events: ProductEventRow[], name: string): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.name !== name) continue;
    const id = event.meta?.voucher;
    if (typeof id === 'string') ids.add(id);
  }
  return ids.size;
}

export type ApprovalSplit = {
  /** Vouchers paid after somebody approved them. */
  approved: number;
  /** Vouchers paid immediately, in an organisation with approval switched off. */
  straightThrough: number;
};

/**
 * How the paid vouchers got there.
 *
 * Reads the flag the 0026 trigger sets rather than inferring it from the absence
 * of an approval event, because absence is ambiguous: an organisation that
 * switched approval on last week has vouchers of both shapes, and the flag is
 * recorded per voucher at the moment it was paid.
 */
export function approvalSplit(events: ProductEventRow[]): ApprovalSplit {
  let approved = 0;
  let straightThrough = 0;

  for (const event of events) {
    if (event.name !== 'voucher_paid') continue;
    if (event.meta?.skipped_approval === true) straightThrough += 1;
    else approved += 1;
  }

  return { approved, straightThrough };
}

export type InviteFunnel = { sent: number; accepted: number; rate: number | null };

/**
 * Whether copy-a-link works as a way of getting a team in.
 *
 * `invite_accepted` has existed since 0022 and was uninterpretable on its own:
 * four acceptances is excellent out of five invites and dismal out of eighty.
 * `invite_sent` arrived in 0026, so the rate only starts being meaningful from
 * then — which is why the screen says so rather than showing a rate above 100%
 * for the period where acceptances have no matching sends.
 */
export function inviteFunnel(events: ProductEventRow[]): InviteFunnel {
  const sent = events.filter((e) => e.name === 'invite_sent').length;
  const accepted = events.filter((e) => e.name === 'invite_accepted').length;

  return { sent, accepted, rate: sent === 0 ? null : Math.round((accepted / sent) * 1000) / 10 };
}

/**
 * Organisations that set up more than the head office they were given.
 *
 * Setup depth rather than a funnel step, per the note at the top of this file.
 */
export function setupDepth(events: ProductEventRow[]): { organisations: number; chapters: number } {
  const chapters = events.filter((e) => e.name === 'chapter_created');
  const organisations = new Set(
    chapters.map((e) => e.organization_id).filter((id): id is string => Boolean(id)),
  );

  return { organisations: organisations.size, chapters: chapters.length };
}

export type TimeToValue = {
  /** Organisations that have both a start and a first submission. */
  samples: number;
  medianHours: number | null;
  /** The slowest one, which is usually the interesting one. */
  slowestHours: number | null;
};

/**
 * How long an organisation takes to get from existing to submitting something.
 *
 * The one measure here that is about the product rather than about counting it.
 * Computed per organisation from its own two events, so an organisation that
 * signed up months ago and submitted yesterday reports months, which is the
 * truth and is worth seeing.
 *
 * Median rather than mean: with a handful of tenants a single abandoned
 * workspace moves a mean further than it moves the reality.
 */
export function timeToValue(events: ProductEventRow[]): TimeToValue {
  const started = new Map<string, number>();
  const submitted = new Map<string, number>();

  for (const event of events) {
    const org = event.organization_id;
    if (!org) continue;
    const at = Date.parse(event.created_at);
    if (Number.isNaN(at)) continue;

    if (event.name === 'organisation_created') {
      started.set(org, Math.min(started.get(org) ?? at, at));
    } else if (event.name === 'voucher_submitted') {
      submitted.set(org, Math.min(submitted.get(org) ?? at, at));
    }
  }

  const spans: number[] = [];
  for (const [org, start] of started) {
    const first = submitted.get(org);
    if (first === undefined || first < start) continue;
    spans.push((first - start) / 3_600_000);
  }

  if (spans.length === 0) return { samples: 0, medianHours: null, slowestHours: null };

  spans.sort((a, b) => a - b);
  const middle = Math.floor(spans.length / 2);
  const median =
    spans.length % 2 === 0 ? (spans[middle - 1] + spans[middle]) / 2 : spans[middle];

  return {
    samples: spans.length,
    medianHours: Math.round(median * 10) / 10,
    slowestHours: Math.round(spans[spans.length - 1] * 10) / 10,
  };
}

/**
 * Every event by day, for the trend line.
 *
 * Shaped to match what `Trend` already renders — `views` carries the count and
 * `visitors` the number of distinct organisations behind it, so one chart shows
 * both how much happened and how concentrated it was.
 */
export function activityByDay(
  events: ProductEventRow[],
  days = 30,
  today = new Date(),
): { day: string; views: number; visitors: number }[] {
  const counts = new Map<string, number>();
  const orgs = new Map<string, Set<string>>();

  for (const event of events) {
    const day = event.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
    if (event.organization_id) {
      (orgs.get(day) ?? orgs.set(day, new Set()).get(day)!).add(event.organization_id);
    }
  }

  const out: { day: string; views: number; visitors: number }[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, views: counts.get(key) ?? 0, visitors: orgs.get(key)?.size ?? 0 });
  }

  return out;
}

/** Occurrences per event name, most frequent first. Anything not in ACTIVATION included. */
export function tallyEvents(events: ProductEventRow[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.name, (counts.get(event.name) ?? 0) + 1);

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Hours as something a person reads.
 *
 * Kept here rather than in Figures because it is the only place that needs it
 * and because the thresholds are chosen for this data: spans of a few minutes
 * and spans of several weeks both occur, and one format cannot serve both.
 */
export function span(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} hr`;
  const days = hours / 24;
  if (days < 14) return `${Math.round(days)} days`;
  return `${Math.round(days / 7)} weeks`;
}

import { describe, expect, it } from 'vitest';
import type { ProductEventRow } from '@/lib/supabase/types';
import {
  ACTIVATION,
  activation,
  activityByDay,
  approvalSplit,
  distinctVouchers,
  inviteFunnel,
  setupDepth,
  span,
  tallyEvents,
  timeToValue,
  waitingOn,
} from './funnel';

/**
 * The funnel, tested for the mistakes a funnel actually makes.
 *
 * Not "does it add up" — it is a group-by, it adds up. The failures worth
 * catching here are the ones that produce a plausible chart: counting
 * occurrences where the question was how many organisations, attributing an
 * event to the wrong subject, or letting a resubmission look like a second
 * voucher. Each of those renders as a working funnel with the wrong shape.
 */

let next = 0;

const event = (
  name: string,
  over: Partial<ProductEventRow> = {},
): ProductEventRow => ({
  id: (next += 1),
  name,
  actor_id: null,
  organization_id: null,
  meta: null,
  created_at: '2026-08-01T10:00:00.000Z',
  ...over,
});

describe('the activation funnel', () => {
  it('reports the five sequential stages, in order', () => {
    const stages = activation([]);

    expect(stages.map((s) => s.event)).toEqual([
      'account_created',
      'organisation_created',
      'voucher_drafted',
      'voucher_submitted',
      'voucher_paid',
    ]);
    expect(stages).toHaveLength(ACTIVATION.length);
  });

  it('leaves out the two events that are not prerequisites', () => {
    // A funnel step asserts the step before it was required. Neither of these
    // is: the head office chapter is seeded, and approval can be switched off.
    const events = ACTIVATION.map((s) => s.event);

    expect(events).not.toContain('chapter_created');
    expect(events).not.toContain('voucher_approved');
  });

  it('separates how often it happened from how many got that far', () => {
    // Two organisations, four drafts. A funnel that reported 4 would be saying
    // four tenants started work.
    const stages = activation([
      event('voucher_drafted', { organization_id: 'a' }),
      event('voucher_drafted', { organization_id: 'a' }),
      event('voucher_drafted', { organization_id: 'b' }),
      event('voucher_drafted', { organization_id: 'b' }),
    ]);

    const drafted = stages.find((s) => s.event === 'voucher_drafted')!;
    expect(drafted.occurrences).toBe(4);
    expect(drafted.reached).toBe(2);
  });

  it('counts the signup stage by person and every later stage by organisation', () => {
    // account_created carries no organisation — the account does not belong to
    // one yet, which is the whole point of measuring it separately.
    const stages = activation([
      event('account_created', { actor_id: 'p1' }),
      event('account_created', { actor_id: 'p2' }),
      event('account_created', { actor_id: 'p3' }),
      event('organisation_created', { actor_id: 'p1', organization_id: 'a' }),
    ]);

    expect(stages[0].reached).toBe(3);
    expect(stages[0].subject).toBe('person');
    expect(stages[1].reached).toBe(1);
    expect(stages[1].subject).toBe('organisation');
  });

  it('converts against distinct subjects, not occurrences', () => {
    const stages = activation([
      event('account_created', { actor_id: 'p1' }),
      event('account_created', { actor_id: 'p2' }),
      event('organisation_created', { organization_id: 'a' }),
      // A second workspace event for the same org must not push this over 50%.
      event('organisation_created', { organization_id: 'a' }),
    ]);

    expect(stages[1].fromPrevious).toBe(50);
    expect(stages[1].fromStart).toBe(50);
  });

  it('counts an unattributable event as having happened, but not as anybody arriving', () => {
    const stages = activation([event('voucher_drafted', { organization_id: null })]);
    const drafted = stages.find((s) => s.event === 'voucher_drafted')!;

    expect(drafted.occurrences).toBe(1);
    expect(drafted.reached).toBe(0);
  });

  it('leaves conversion null rather than dividing by nothing', () => {
    const stages = activation([event('voucher_drafted', { organization_id: 'a' })]);

    expect(stages[0].fromPrevious).toBeNull();
    expect(stages[1].fromPrevious).toBeNull();
  });
});

describe('distinct vouchers behind an outcome', () => {
  it('does not let a rejected-then-approved voucher count twice', () => {
    const events = [
      event('voucher_submitted', { organization_id: 'a' }),
      event('voucher_rejected', { organization_id: 'a', meta: { voucher: 'v1' } }),
      event('voucher_submitted', { organization_id: 'a' }),
      event('voucher_approved', { organization_id: 'a', meta: { voucher: 'v1' } }),
      event('voucher_approved', { organization_id: 'a', meta: { voucher: 'v2' } }),
    ];

    // Three approval acts would be wrong; two vouchers reached approved.
    expect(distinctVouchers(events, 'voucher_approved')).toBe(2);
    expect(distinctVouchers(events, 'voucher_rejected')).toBe(1);
  });

  it('ignores an outcome whose meta lost the voucher id', () => {
    expect(distinctVouchers([event('voucher_paid', { meta: {} })], 'voucher_paid')).toBe(0);
  });
});

describe('how paid vouchers got there', () => {
  it('splits on the recorded flag rather than on a missing approval event', () => {
    const split = approvalSplit([
      event('voucher_paid', { meta: { skipped_approval: true } }),
      event('voucher_paid', { meta: { skipped_approval: false } }),
      event('voucher_paid', { meta: { skipped_approval: false } }),
    ]);

    expect(split).toEqual({ approved: 2, straightThrough: 1 });
  });

  it('treats a paid voucher with no flag as having been approved', () => {
    // Rows written before 0026 carry no flag. Assuming approval is the safer
    // reading: it is what the default policy does.
    expect(approvalSplit([event('voucher_paid')])).toEqual({
      approved: 1,
      straightThrough: 0,
    });
  });
});

describe('the invite funnel', () => {
  it('reports a rate once there is a denominator', () => {
    expect(
      inviteFunnel([
        event('invite_sent'),
        event('invite_sent'),
        event('invite_sent'),
        event('invite_sent'),
        event('invite_accepted'),
      ]),
    ).toEqual({ sent: 4, accepted: 1, rate: 25 });
  });

  it('refuses a rate when nothing was sent, rather than showing infinity', () => {
    // The state of every acceptance recorded before 0026 added invite_sent.
    const funnel = inviteFunnel([event('invite_accepted')]);

    expect(funnel.accepted).toBe(1);
    expect(funnel.rate).toBeNull();
  });
});

describe('setup depth', () => {
  it('counts chapters beyond the seeded head office, and who made them', () => {
    expect(
      setupDepth([
        event('chapter_created', { organization_id: 'a' }),
        event('chapter_created', { organization_id: 'a' }),
        event('chapter_created', { organization_id: 'b' }),
      ]),
    ).toEqual({ organisations: 2, chapters: 3 });
  });
});

describe('time to value', () => {
  it('measures each organisation from its own start to its own first submission', () => {
    const result = timeToValue([
      event('organisation_created', {
        organization_id: 'a',
        created_at: '2026-08-01T00:00:00.000Z',
      }),
      event('voucher_submitted', {
        organization_id: 'a',
        created_at: '2026-08-01T05:00:00.000Z',
      }),
      event('organisation_created', {
        organization_id: 'b',
        created_at: '2026-08-01T00:00:00.000Z',
      }),
      event('voucher_submitted', {
        organization_id: 'b',
        created_at: '2026-08-02T00:00:00.000Z',
      }),
    ]);

    expect(result.samples).toBe(2);
    expect(result.medianHours).toBe(14.5);
    expect(result.slowestHours).toBe(24);
  });

  it('takes the earliest submission when there are several', () => {
    const result = timeToValue([
      event('organisation_created', {
        organization_id: 'a',
        created_at: '2026-08-01T00:00:00.000Z',
      }),
      event('voucher_submitted', {
        organization_id: 'a',
        created_at: '2026-08-05T00:00:00.000Z',
      }),
      event('voucher_submitted', {
        organization_id: 'a',
        created_at: '2026-08-01T02:00:00.000Z',
      }),
    ]);

    expect(result.medianHours).toBe(2);
  });

  it('ignores an organisation that has never submitted anything', () => {
    const result = timeToValue([
      event('organisation_created', { organization_id: 'a' }),
      event('organisation_created', { organization_id: 'b' }),
    ]);

    expect(result).toEqual({ samples: 0, medianHours: null, slowestHours: null });
  });

  it('ignores a submission that predates the workspace', () => {
    // Should be impossible, and would produce a negative span if it happened.
    const result = timeToValue([
      event('organisation_created', {
        organization_id: 'a',
        created_at: '2026-08-05T00:00:00.000Z',
      }),
      event('voucher_submitted', {
        organization_id: 'a',
        created_at: '2026-08-01T00:00:00.000Z',
      }),
    ]);

    expect(result.samples).toBe(0);
  });
});

describe('activity by day', () => {
  it('fills the days nothing happened on, so the trend has no gaps', () => {
    const points = activityByDay(
      [event('voucher_drafted', { organization_id: 'a', created_at: '2026-08-03T09:00:00.000Z' })],
      3,
      new Date('2026-08-03T23:00:00.000Z'),
    );

    expect(points.map((p) => p.day)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(points.map((p) => p.views)).toEqual([0, 0, 1]);
  });

  it('carries the number of distinct organisations behind each day', () => {
    const day = '2026-08-03T09:00:00.000Z';
    const points = activityByDay(
      [
        event('voucher_drafted', { organization_id: 'a', created_at: day }),
        event('voucher_drafted', { organization_id: 'a', created_at: day }),
        event('voucher_drafted', { organization_id: 'b', created_at: day }),
      ],
      1,
      new Date('2026-08-03T23:00:00.000Z'),
    );

    expect(points[0]).toEqual({ day: '2026-08-03', views: 3, visitors: 2 });
  });
});

describe('the small helpers', () => {
  it('tallies every event name, busiest first', () => {
    expect(
      tallyEvents([event('voucher_drafted'), event('voucher_drafted'), event('invite_sent')]),
    ).toEqual([
      { label: 'voucher_drafted', count: 2 },
      { label: 'invite_sent', count: 1 },
    ]);
  });

  it('formats a span at the scale it happens to be', () => {
    expect(span(null)).toBe('—');
    expect(span(0.25)).toBe('15 min');
    expect(span(0.001)).toBe('1 min');
    expect(span(5)).toBe('5 hr');
    expect(span(47)).toBe('47 hr');
    expect(span(72)).toBe('3 days');
    expect(span(24 * 30)).toBe('4 weeks');
  });
});

describe('who is not acting', () => {
  const NOW = Date.parse('2026-08-21T12:00:00.000Z');

  const stuckRow = (over = {}) => ({
    organization_id: 'a',
    organization_name: 'Acme',
    status: 'pending_first',
    waiting: 1,
    oldest_days: 3,
    ...over,
  });

  it('folds several states of one organisation into one row', () => {
    const [row] = waitingOn({
      stuck: [
        stuckRow({ status: 'pending_first', waiting: 2, oldest_days: 4 }),
        stuckRow({ status: 'approved', waiting: 3, oldest_days: 11 }),
      ],
      memberOrg: new Map(),
      views: [],
      now: NOW,
    });

    expect(row.waiting).toBe(5);
    expect(row.oldestDays).toBe(11);
    expect(row.states.map((s) => s.status)).toEqual(['approved', 'pending_first']);
  });

  it('sorts by how long nobody has looked, not by how much is waiting', () => {
    // The ordering that makes this screen worth having. Nine vouchers somebody
    // is working through is a queue; one nobody has been told about is the bug.
    const rows = waitingOn({
      stuck: [
        stuckRow({ organization_id: 'busy', organization_name: 'Busy', waiting: 9 }),
        stuckRow({ organization_id: 'quiet', organization_name: 'Quiet', waiting: 1 }),
      ],
      memberOrg: new Map([['a@busy.test', 'busy'], ['b@quiet.test', 'quiet']]),
      views: [
        { email: 'a@busy.test', occurred_at: '2026-08-21T09:00:00.000Z' },
        { email: 'b@quiet.test', occurred_at: '2026-08-01T09:00:00.000Z' },
      ],
      now: NOW,
    });

    expect(rows.map((r) => r.organisation)).toEqual(['Quiet', 'Busy']);
    expect(rows[0].silentDays).toBe(20);
    expect(rows[1].silentDays).toBe(0);
  });

  it('puts an organisation nobody has ever been seen in at the very top', () => {
    // Null is the worst case here, not a missing value, so it must not sort last.
    const rows = waitingOn({
      stuck: [
        stuckRow({ organization_id: 'seen', organization_name: 'Seen', waiting: 40 }),
        stuckRow({ organization_id: 'never', organization_name: 'Never' }),
      ],
      memberOrg: new Map([['a@seen.test', 'seen']]),
      views: [{ email: 'a@seen.test', occurred_at: '2026-07-01T09:00:00.000Z' }],
      now: NOW,
    });

    expect(rows[0].organisation).toBe('Never');
    expect(rows[0].silentDays).toBeNull();
    expect(rows[0].lastSeen).toBeNull();
  });

  it('takes the later of a page view and a recorded milestone', () => {
    // Signing in to read the register makes a view and no milestone; the reverse
    // is possible too. Either one means somebody was there.
    const [row] = waitingOn({
      stuck: [stuckRow()],
      memberOrg: new Map([['a@acme.test', 'a']]),
      views: [{ email: 'a@acme.test', occurred_at: '2026-08-10T09:00:00.000Z' }],
      lastEventByOrg: new Map([['a', '2026-08-20T09:00:00.000Z']]),
      now: NOW,
    });

    expect(row.silentDays).toBe(1);
  });

  it('ignores a page view from somebody who belongs to no organisation', () => {
    const [row] = waitingOn({
      stuck: [stuckRow()],
      memberOrg: new Map(),
      views: [{ email: 'stranger@nowhere.test', occurred_at: '2026-08-21T09:00:00.000Z' }],
      now: NOW,
    });

    expect(row.silentDays).toBeNull();
  });
});

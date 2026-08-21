import { describe, expect, it } from 'vitest';
import {
  operatorMembers,
  operatorOnboarding,
  operatorStuckVouchers,
  operatorTenants,
  operatorWorkflowStages,
  product_events,
} from './operator';
import { activation, distinctVouchers, tallyEvents } from '@/lib/analytics/funnel';
import * as fixtures from './fixtures';

/**
 * The activation screen showed three cards disagreeing about the same fact.
 *
 * The funnel said two vouchers had reached paid, the approval split said all of
 * them were approved first, and "Vouchers paid" said zero. All three read the
 * same events; the third counts *distinct* vouchers, which it does by looking
 * for a voucher id in the event meta, because a resubmitted voucher passes
 * through these states twice. The derived events carried no id, so every
 * distinct count on the screen was zero.
 *
 * Nothing caught it because nothing compared the two. These tests do.
 */
describe('preview product events', () => {
  const VOUCHER_EVENTS = [
    'voucher_drafted',
    'voucher_submitted',
    'voucher_approved',
    'voucher_rejected',
    'voucher_paid',
  ];

  it('records something for every fixture voucher', () => {
    const live = fixtures.vouchers.filter((v) => !v.deleted_at);
    expect(distinctVouchers(product_events, 'voucher_drafted')).toBe(live.length);
  });

  it('carries the voucher id on every voucher event', () => {
    for (const name of VOUCHER_EVENTS) {
      const events = product_events.filter((e) => e.name === name);
      for (const e of events) {
        expect(typeof e.meta?.voucher, `${name} #${e.id}`).toBe('string');
      }
    }
  });

  /*
   * The specific disagreement: a screen can count occurrences or vouchers, and
   * both have to be answerable. Neither may be zero while the other is not.
   */
  it('lets a screen count occurrences or vouchers, never one but not the other', () => {
    const counts = new Map(tallyEvents(product_events).map((r) => [r.label, r.count]));
    for (const name of VOUCHER_EVENTS) {
      const occurrences = counts.get(name) ?? 0;
      const vouchers = distinctVouchers(product_events, name);
      expect(occurrences > 0, name).toBe(vouchers > 0);
      // A voucher cannot reach a state more times than the state was reached.
      expect(vouchers, name).toBeLessThanOrEqual(occurrences);
    }
  });

  it('marks paid vouchers as approved or straight through, and never both', () => {
    for (const e of product_events.filter((x) => x.name === 'voucher_paid')) {
      expect(typeof e.meta?.skipped_approval).toBe('boolean');
    }
  });

  /*
   * Milestones are read off the voucher, not off its audit trail, because that
   * is what the trigger sees. Two fixtures are paid with no marked_paid audit
   * entry, and deriving from the trail alone reported one paid voucher on a
   * screen sitting beside a register showing two.
   */
  it('counts a paid voucher even when its audit trail is incomplete', () => {
    const paid = fixtures.vouchers.filter((v) => v.status === 'paid' && !v.deleted_at);
    expect(paid.length).toBeGreaterThan(1);
    expect(distinctVouchers(product_events, 'voucher_paid')).toBe(paid.length);
  });

  it('builds a funnel whose every step is reachable from the one above', () => {
    const steps = activation(product_events);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].reached).toBeGreaterThan(0);
    for (const step of steps.slice(1)) {
      expect(step.reached, step.event).toBeGreaterThan(0);
    }
  });
});

describe('preview operator functions', () => {
  it('returns one row per organisation, with its own counts', () => {
    const tenants = operatorTenants();
    expect(tenants).toHaveLength(fixtures.organizations.length);
    const [only] = tenants;
    expect(only.name).toBe(fixtures.organizations[0].name);
    expect(only.members).toBe(fixtures.profiles.length);
    expect(only.vouchers_drafted).toBeGreaterThan(0);
    expect(only.first_event).not.toBeNull();
  });

  it('gives every member their organisation name', () => {
    for (const m of operatorMembers()) {
      expect(m.organization_id).toBe(fixtures.PREVIEW_ORG_ID);
      expect(m.organization_name).toBe(fixtures.organizations[0].name);
    }
  });

  it('lists nobody as stalled on onboarding, because everybody has a workspace', () => {
    expect(operatorOnboarding()).toEqual([]);
  });

  it('times only the stages a voucher actually passed through', () => {
    const stages = operatorWorkflowStages();
    expect(stages.length).toBeGreaterThan(0);
    for (const s of stages) {
      expect(s.samples).toBeGreaterThan(0);
      expect(s.median_hours).not.toBeNull();
      // p90 is at or behind the median by definition.
      expect(s.p90_hours!).toBeGreaterThanOrEqual(s.median_hours!);
    }
  });

  it('widens what counts as stuck as the threshold shrinks', () => {
    const total = (days: number) =>
      operatorStuckVouchers(days).reduce((n, r) => n + r.waiting, 0);
    expect(total(1)).toBeGreaterThanOrEqual(total(90));
  });

  it('never reports a settled voucher as waiting', () => {
    for (const row of operatorStuckVouchers(1)) {
      expect(['draft', 'pending_first', 'pending_second', 'approved', 'rejected']).toContain(
        row.status,
      );
    }
  });
});

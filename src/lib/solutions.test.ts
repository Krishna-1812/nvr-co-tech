import { describe, expect, it } from 'vitest';
import { SOLUTIONS } from './solutions';
import { ASSIST_SLUG, assistSection, reconSection, voucherSection } from './nav';

/**
 * The roster and the navigation have to agree about what a tool is called.
 *
 * The breadcrumb in the top bar looks a Section's slug up in SOLUTIONS to find
 * the tool's mark and its accent, and falls back to the assistant's when it finds
 * nothing. That fallback is correct for the assistant and wrong for everything
 * else: a new tool whose slug did not match would still render, in the wrong
 * colour, with the wrong icon, and nothing would fail.
 */
describe('the nav sections and the roster agree', () => {
  const slugs = new Set(SOLUTIONS.map((solution) => solution.slug));

  it.each([
    ['Voucher Desk', voucherSection({ role: 'owner' })],
    ['Ledger Reconciliation', reconSection()],
  ])('%s has a roster entry, so it gets its own mark and accent', (_name, section) => {
    expect(slugs.has(section.slug)).toBe(true);
  });

  it('the assistant deliberately has none', () => {
    // It is a way of asking about the tools rather than one of them, and the slug
    // is what keeps that distinction enforceable. See ASSIST_SLUG.
    expect(assistSection().slug).toBe(ASSIST_SLUG);
    expect(slugs.has(ASSIST_SLUG)).toBe(false);
  });

  it('every tool with a roster entry has somewhere for its crumb to lead', () => {
    for (const [, section] of [
      ['Voucher Desk', voucherSection({ role: 'owner' })],
      ['Ledger Reconciliation', reconSection()],
    ] as const) {
      const solution = SOLUTIONS.find((entry) => entry.slug === section.slug);
      expect(solution?.stage).toBe('live');
      expect(section.home.startsWith('/')).toBe(true);
    }
  });
});

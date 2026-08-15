import { describe, expect, it } from 'vitest';
import { scoreIntent, stageFor } from './intent';

/**
 * The intent score.
 *
 * Every assertion here is really about a cap. An uncapped score is one where a
 * single repeated behaviour outranks a genuinely broader interest, and it is
 * the difference between a number a salesperson acts on and a number they learn
 * to ignore.
 */

const base = { sessions: 1, engagedSeconds: 0 };

describe('scoring intent', () => {
  it('lets no single page run away with the high-intent tier', () => {
    // Somebody who opened the pricing page eleven times is genuinely interested,
    // so this is not scored as zero — but past the second view the high tier
    // stops paying, and everything further they earn has to come from depth.
    // Without that cap one refreshed tab would outrank every other signal
    // combined.
    const twice = scoreIntent({ ...base, pages: ['/pricing', '/pricing'] });
    const eleven = scoreIntent({ ...base, pages: Array(11).fill('/pricing') });

    const high = (r: typeof twice) => r.factors.find((f) => f.label.includes('high-intent'))!.points;
    expect(high(twice)).toBe(high(eleven));
    expect(eleven.score - twice.score).toBeLessThanOrEqual(15);
  });

  it('caps the high-intent contribution at two pages worth', () => {
    const two = scoreIntent({ ...base, pages: ['/pricing', '/demo'] });
    const five = scoreIntent({ ...base, pages: ['/pricing', '/demo', '/contact', '/trial', '/quote'] });

    const high = (r: typeof two) => r.factors.find((f) => f.label.includes('high-intent'))!.points;
    expect(high(two)).toBe(40);
    expect(high(five)).toBe(40);
  });

  it('does not count a page in both tiers', () => {
    // /pricing matches the high list; it must not also earn mid-tier points.
    const result = scoreIntent({ ...base, pages: ['/pricing'] });
    expect(result.factors.some((f) => f.label.includes('mid-intent') && f.points > 0)).toBe(false);
  });

  it('rewards coming back, and only from the second visit', () => {
    const once = scoreIntent({ ...base, pages: ['/about'] });
    const thrice = scoreIntent({ ...base, pages: ['/about'], sessions: 3 });

    expect(once.factors.some((f) => f.label.startsWith('Came back'))).toBe(false);
    expect(thrice.factors.some((f) => f.label.startsWith('Came back'))).toBe(true);
  });

  it('ignores attention below two minutes and caps it above twenty', () => {
    const brief = scoreIntent({ ...base, pages: ['/about'], engagedSeconds: 90 });
    const long = scoreIntent({ ...base, pages: ['/about'], engagedSeconds: 4_000 });

    expect(brief.factors.some((f) => f.label.includes('attention'))).toBe(false);
    expect(long.factors.find((f) => f.label.includes('attention'))!.points).toBe(10);
  });

  it('never exceeds 100 however much everything is stacked', () => {
    const result = scoreIntent({
      pages: ['/pricing', '/demo', '/contact', '/platform', '/docs', '/customers', '/integrations'],
      sessions: 12,
      engagedSeconds: 10_000,
      thirdParty: 1,
    });

    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('always explains itself', () => {
    const result = scoreIntent({ ...base, pages: ['/pricing', '/docs'] });
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.factors.every((f) => f.label && f.points > 0)).toBe(true);
  });

  it('maps the score onto the stage a rep actually uses', () => {
    expect(stageFor(85)).toBe('decision');
    expect(stageFor(70)).toBe('decision');
    expect(stageFor(55)).toBe('consideration');
    expect(stageFor(20)).toBe('interest');
    expect(stageFor(4)).toBe('awareness');
  });
});

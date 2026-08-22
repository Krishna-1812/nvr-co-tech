import { describe, expect, it } from 'vitest';
import { candidate } from './fixtures';
import { applyScreen, describeScreen, sizeBand } from './screen';

describe('applyScreen', () => {
  it('keeps everything when no screen is set', () => {
    const { kept, rejected } = applyScreen([candidate('A'), candidate('B')], {});
    expect(kept).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it('preserves the order it was given, because nearest-first is information', () => {
    const { kept } = applyScreen([candidate('First'), candidate('Second'), candidate('Third')], {});
    expect(kept.map((c) => c.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('never drops a candidate without a reason', () => {
    const pool = [
      candidate('Too small', { revenue: 10 }),
      candidate('Foreign', { country: 'SG' }),
      candidate('Unknown revenue', { revenue: null }),
      candidate('Fine'),
    ];
    const { rejected } = applyScreen(pool, { country: 'IN', minRevenue: 500 });
    expect(rejected).toHaveLength(3);
    for (const r of rejected) {
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.decidedBy).toBe('screen');
    }
  });

  it('says "not known" and "outside the band" differently, because they are different facts', () => {
    /*
     * The distinction the whole file is built around. A peer dropped for an
     * unknown revenue is one somebody might go and fetch a filing for; a peer
     * dropped for being forty times too big never becomes relevant however
     * much data you buy. A single "failed the revenue screen" would hide that.
     */
    const { rejected } = applyScreen(
      [candidate('Blank', { revenue: null }), candidate('Huge', { revenue: 90_000 })],
      { minRevenue: 500, maxRevenue: 2_000 },
    );
    expect(rejected[0].reason).toBe('Revenue is not known, so it cannot be placed in the size band');
    expect(rejected[1].reason).toBe('Revenue is above the size band');
  });

  it('does not complain about an unknown revenue when no size screen was asked for', () => {
    const { kept } = applyScreen([candidate('Blank', { revenue: null })], { country: 'IN' });
    expect(kept).toHaveLength(1);
  });

  it('reports the first and most fundamental failure, not an arbitrary one', () => {
    // Malaysian AND tiny AND loss-making. The reader should be told it is
    // Malaysian, because that is the reason that makes the others irrelevant.
    const { rejected } = applyScreen(
      [candidate('Wrong country', { country: 'MY', revenue: 5, ebitda: -100 })],
      { country: 'IN', minRevenue: 500, excludeLossMaking: true },
    );
    expect(rejected[0].reason).toBe('Registered in MY, and the peer set is limited to IN');
  });

  it('excludes the subject from its own peer set', () => {
    const self = candidate('Subject');
    const { kept, rejected } = applyScreen([self, candidate('Other')], {
      excludeCompanyId: self.companyId,
    });
    expect(kept.map((c) => c.name)).toEqual(['Other']);
    expect(rejected[0].reason).toBe(
      'This is the company being valued, so it cannot be its own comparable',
    );
  });

  it('screens on listing status, and names an unknown status as unknown', () => {
    const { rejected } = applyScreen([candidate('Mystery', { listingStatus: 'unknown' })], {
      listingStatus: 'listed',
    });
    expect(rejected[0].reason).toBe(
      'Listing status not known, and the peer set is limited to listed companies',
    );
  });

  it('screens on growth, and says so when growth cannot be computed', () => {
    const pool = [
      candidate('Fast', { revenue: 1_600, priorRevenue: 800 }), // +100%
      candidate('Slow', { revenue: 820, priorRevenue: 800 }), //   +2.5%
      candidate('No prior', { priorRevenue: null }),
    ];
    const { kept, rejected } = applyScreen(pool, { minGrowth: 0.1 });
    expect(kept.map((c) => c.name)).toEqual(['Fast']);
    expect(rejected.map((r) => r.reason)).toEqual([
      'Growing more slowly than the band',
      'Revenue growth cannot be computed, because the prior period is not known',
    ]);
  });

  it('screens on EBITDA margin in both directions', () => {
    const pool = [
      candidate('Thin', { ebitda: 50 }), //  5%
      candidate('Normal'), //               20%
      candidate('Fat', { ebitda: 600 }), // 60%
    ];
    const { kept } = applyScreen(pool, { minEbitdaMargin: 0.1, maxEbitdaMargin: 0.4 });
    expect(kept.map((c) => c.name)).toEqual(['Normal']);
  });

  it('keeps loss-making peers unless asked not to', () => {
    // Off by default on purpose: a loss-making peer still contributes to
    // EV/Revenue, which is often the only multiple that works for the kind of
    // company this tool is pointed at.
    const pool = [candidate('Losing', { ebitda: -100 }), candidate('Earning')];
    expect(applyScreen(pool, {}).kept).toHaveLength(2);

    const strict = applyScreen(pool, { excludeLossMaking: true });
    expect(strict.kept.map((c) => c.name)).toEqual(['Earning']);
    expect(strict.rejected[0].reason).toBe('Loss-making at EBITDA');
  });

  it('treats an unknown EBITDA as failing the loss-making screen, and says which', () => {
    const { rejected } = applyScreen([candidate('Blank', { ebitda: null })], {
      excludeLossMaking: true,
    });
    expect(rejected[0].reason).toBe('EBITDA is not known, and loss-making companies are excluded');
  });

  it('carries through a decidedBy other than screen', () => {
    const { rejected } = applyScreen([candidate('A', { country: 'SG' })], { country: 'IN' }, 'person');
    expect(rejected[0].decidedBy).toBe('person');
  });

  it('treats the size band as inclusive at both ends', () => {
    const pool = [candidate('At floor', { revenue: 500 }), candidate('At ceiling', { revenue: 2_000 })];
    expect(applyScreen(pool, { minRevenue: 500, maxRevenue: 2_000 }).kept).toHaveLength(2);
  });
});

describe('sizeBand', () => {
  it('is a third to three times by default', () => {
    expect(sizeBand(900)).toEqual({ minRevenue: 300, maxRevenue: 2_700 });
  });

  it('takes another factor', () => {
    expect(sizeBand(1_000, 2)).toEqual({ minRevenue: 500, maxRevenue: 2_000 });
  });

  it('refuses to invert the band when handed a factor below one', () => {
    expect(sizeBand(1_000, 0.5)).toEqual({ minRevenue: 1_000, maxRevenue: 1_000 });
  });
});

describe('describeScreen', () => {
  it('says so plainly when nothing was applied', () => {
    // Not an empty string: a blank method note reads like a missing value.
    expect(describeScreen({})).toBe('No screens applied');
  });

  it('describes a band as a band rather than as two constraints', () => {
    expect(describeScreen({ minRevenue: 500, maxRevenue: 2_000 })).toBe(
      'revenue between 500 and 2,000',
    );
  });

  it('describes a one-sided bound', () => {
    expect(describeScreen({ minRevenue: 500 })).toBe('revenue at least 500');
    expect(describeScreen({ maxRevenue: 2_000 })).toBe('revenue at most 2,000');
  });

  it('joins everything it constrained', () => {
    expect(
      describeScreen({
        country: 'IN',
        listingStatus: 'listed',
        minGrowth: 0.1,
        excludeLossMaking: true,
      }),
    ).toBe('registered in IN; listed companies only; growth at least 10%; profitable at EBITDA');
  });
});

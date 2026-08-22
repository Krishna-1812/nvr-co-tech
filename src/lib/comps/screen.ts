/**
 * The hard screens — the mechanical half of peer selection.
 *
 * Nearest-neighbour search over business descriptions finds companies that do
 * something similar (see `find_peers` in migration 0028). That is necessary and
 * not sufficient: a ₹40 crore regional logistics operator and a ₹40,000 crore
 * national one do the same thing and trade at nothing like the same multiple, so
 * size, geography, growth and profitability still have to be applied.
 *
 * ── Every rejection carries a reason, and the reason has to be true ───────
 *
 * `applyScreen` returns what it dropped as well as what it kept, and each
 * rejection names why. `peer_set_members.excluded_reason` is NOT NULL for the
 * same purpose: a reviewer challenging a peer set wants to know what was
 * considered and rejected, and "we looked at eleven and used seven, here are the
 * four and why" is a far stronger answer than a list of seven.
 *
 * The reasons distinguish between "the figure was outside the band" and "there
 * was no figure", which are different facts about a company and lead to
 * different actions. A peer dropped because its revenue is unknown is a peer
 * somebody might go and fetch a filing for; a peer dropped because it is forty
 * times too big never becomes relevant however much data you buy. A single
 * "failed the revenue screen" would have hidden that difference.
 *
 * ── Order matters, and it is the order a person would use ─────────────────
 *
 * The checks run cheapest and most decisive first: country, then listing status,
 * then size, then growth, then margin. A candidate is rejected on the first
 * check it fails and the rest are not evaluated, so the reason a reader sees is
 * the first and most fundamental thing wrong with it rather than an arbitrary one
 * of several. A Malaysian company in an India-only peer set is rejected for being
 * Malaysian, not for its EBITDA margin.
 */

import { ebitdaMargin, isKnown, revenueGrowth } from './multiples';
import type { Candidate, DecidedBy, ScreenResult } from './types';
import type { ListingStatus } from './types';

/**
 * A screen. Every field is optional and an absent field applies no constraint —
 * so an empty screen keeps everything, which is the right default for a first
 * look at an unfamiliar industry.
 */
export type Screen = {
  country?: string;
  listingStatus?: ListingStatus;
  /** Inclusive bounds, in the peer set's currency. */
  minRevenue?: number;
  maxRevenue?: number;
  /** Fractions, not percentages: 0.15 is fifteen per cent. */
  minGrowth?: number;
  maxGrowth?: number;
  minEbitdaMargin?: number;
  maxEbitdaMargin?: number;
  /**
   * Drop peers with a non-positive EBITDA.
   *
   * Off by default. A loss-making peer still contributes to EV/Revenue, which is
   * frequently the only multiple that works for the kind of company somebody is
   * valuing with this tool, and dropping it from the whole set to tidy up one
   * column throws away the evidence that the industry contains loss-making
   * companies at all.
   */
  excludeLossMaking?: boolean;
  /** A company that is the subject itself, so it cannot be its own peer. */
  excludeCompanyId?: string;
};

/**
 * How many multiples of the subject's size to allow, when a size band is
 * expressed relatively rather than absolutely.
 *
 * Three is the convention in practice — a peer between a third and three times
 * the subject's revenue — and it is offered as a helper rather than a default
 * because the right band depends on the industry. In a sector of five listed
 * companies, a band that strict leaves nothing.
 */
export function sizeBand(subjectRevenue: number, factor = 3): { minRevenue: number; maxRevenue: number } {
  const f = Math.max(factor, 1);
  return { minRevenue: subjectRevenue / f, maxRevenue: subjectRevenue * f };
}

/** The first reason a candidate fails, or null if it passes everything. */
function rejectionReason(c: Candidate, s: Screen): string | null {
  if (s.excludeCompanyId && c.companyId === s.excludeCompanyId) {
    return 'This is the company being valued, so it cannot be its own comparable';
  }

  if (s.country && c.country !== s.country) {
    return `Registered in ${c.country}, and the peer set is limited to ${s.country}`;
  }

  if (s.listingStatus && c.listingStatus !== s.listingStatus) {
    return `${c.listingStatus === 'unknown' ? 'Listing status not known' : `Is ${c.listingStatus}`}, and the peer set is limited to ${s.listingStatus} companies`;
  }

  const wantsSize = s.minRevenue !== undefined || s.maxRevenue !== undefined;
  if (wantsSize && !isKnown(c.revenue)) {
    return 'Revenue is not known, so it cannot be placed in the size band';
  }
  if (isKnown(c.revenue)) {
    if (s.minRevenue !== undefined && c.revenue < s.minRevenue) {
      return 'Revenue is below the size band';
    }
    if (s.maxRevenue !== undefined && c.revenue > s.maxRevenue) {
      return 'Revenue is above the size band';
    }
  }

  const wantsGrowth = s.minGrowth !== undefined || s.maxGrowth !== undefined;
  if (wantsGrowth) {
    const growth = revenueGrowth(c);
    if (!isKnown(growth)) {
      return 'Revenue growth cannot be computed, because the prior period is not known';
    }
    if (s.minGrowth !== undefined && growth < s.minGrowth) return 'Growing more slowly than the band';
    if (s.maxGrowth !== undefined && growth > s.maxGrowth) return 'Growing faster than the band';
  }

  const wantsMargin = s.minEbitdaMargin !== undefined || s.maxEbitdaMargin !== undefined;
  if (wantsMargin) {
    const margin = ebitdaMargin(c);
    if (!isKnown(margin)) {
      return 'EBITDA margin cannot be computed, because EBITDA or revenue is not known';
    }
    if (s.minEbitdaMargin !== undefined && margin < s.minEbitdaMargin) {
      return 'EBITDA margin is below the band';
    }
    if (s.maxEbitdaMargin !== undefined && margin > s.maxEbitdaMargin) {
      return 'EBITDA margin is above the band';
    }
  }

  if (s.excludeLossMaking) {
    if (!isKnown(c.ebitda)) return 'EBITDA is not known, and loss-making companies are excluded';
    if (c.ebitda <= 0) return 'Loss-making at EBITDA';
  }

  return null;
}

/**
 * Apply a screen, keeping the reasons.
 *
 * `decidedBy` is stamped on every rejection so the stored peer set can
 * distinguish a mechanical drop from one a person made. It defaults to 'screen'
 * because that is what this function is; a person overriding it afterwards
 * records their own.
 *
 * Order within `kept` is the order candidates arrived in — which, coming out of
 * `find_peers`, is nearest first. Preserving it matters: the most similar company
 * should be the top row of the schedule, and re-sorting by size or by multiple is
 * a display decision the screen has no business making.
 */
export function applyScreen(
  candidates: readonly Candidate[],
  screen: Screen,
  decidedBy: DecidedBy = 'screen',
): ScreenResult {
  const kept: Candidate[] = [];
  const rejected: ScreenResult['rejected'] = [];

  for (const candidate of candidates) {
    const reason = rejectionReason(candidate, screen);
    if (reason) rejected.push({ candidate, reason, decidedBy });
    else kept.push(candidate);
  }

  return { kept, rejected };
}

/**
 * A one-line description of what a screen actually constrained.
 *
 * Written for the schedule's method note, so the peer set carries its own
 * explanation rather than the reader having to reconstruct it from which
 * companies survived. An empty screen says so plainly instead of returning an
 * empty string that reads like a missing value.
 */
export function describeScreen(s: Screen): string {
  const parts: string[] = [];

  if (s.country) parts.push(`registered in ${s.country}`);
  if (s.listingStatus) parts.push(`${s.listingStatus} companies only`);

  if (s.minRevenue !== undefined && s.maxRevenue !== undefined) {
    parts.push(`revenue between ${s.minRevenue.toLocaleString('en-IN')} and ${s.maxRevenue.toLocaleString('en-IN')}`);
  } else if (s.minRevenue !== undefined) {
    parts.push(`revenue at least ${s.minRevenue.toLocaleString('en-IN')}`);
  } else if (s.maxRevenue !== undefined) {
    parts.push(`revenue at most ${s.maxRevenue.toLocaleString('en-IN')}`);
  }

  if (s.minGrowth !== undefined) parts.push(`growth at least ${(s.minGrowth * 100).toFixed(0)}%`);
  if (s.maxGrowth !== undefined) parts.push(`growth at most ${(s.maxGrowth * 100).toFixed(0)}%`);
  if (s.minEbitdaMargin !== undefined) {
    parts.push(`EBITDA margin at least ${(s.minEbitdaMargin * 100).toFixed(0)}%`);
  }
  if (s.maxEbitdaMargin !== undefined) {
    parts.push(`EBITDA margin at most ${(s.maxEbitdaMargin * 100).toFixed(0)}%`);
  }
  if (s.excludeLossMaking) parts.push('profitable at EBITDA');

  return parts.length === 0 ? 'No screens applied' : parts.join('; ');
}

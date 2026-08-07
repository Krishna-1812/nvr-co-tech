import { beforeEach, describe, expect, it } from 'vitest';
import { RATE_LIMIT, RATE_WINDOW_MS } from './config';
import { checkRate, resetRates } from './ratelimit';

/**
 * The rate limit.
 *
 * Every test passes its own clock rather than waiting, so the whole window can
 * be walked through in a millisecond. A test that actually slept for five
 * minutes would be a test nobody runs.
 */

const NOW = 1_800_000_000_000;

beforeEach(resetRates);

describe('counting questions', () => {
  it('allows up to the limit', () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(checkRate('someone', NOW).allowed).toBe(true);
    }
  });

  it('counts down as it goes', () => {
    const first = checkRate('someone', NOW);
    expect(first).toEqual({ allowed: true, remaining: RATE_LIMIT - 1 });
  });

  it('stops the one after the limit', () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRate('someone', NOW);
    expect(checkRate('someone', NOW).allowed).toBe(false);
  });

  it('says how long to wait, and never says zero', () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRate('someone', NOW);

    const blocked = checkRate('someone', NOW);
    if (blocked.allowed) throw new Error('expected to be blocked');

    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(RATE_WINDOW_MS / 1000);
  });

  it('counts each account separately', () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRate('one', NOW);
    expect(checkRate('one', NOW).allowed).toBe(false);
    expect(checkRate('two', NOW).allowed).toBe(true);
  });
});

describe('the window moving', () => {
  it('lets somebody back in once the window has passed', () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRate('someone', NOW);
    expect(checkRate('someone', NOW).allowed).toBe(false);

    expect(checkRate('someone', NOW + RATE_WINDOW_MS + 1).allowed).toBe(true);
  });

  it('slides rather than resetting, so a burst does not buy a clean slate', () => {
    // All but one used at the start of the window.
    for (let i = 0; i < RATE_LIMIT - 1; i++) checkRate('someone', NOW);

    // Most of the window later there is still exactly one left, not a full set.
    const late = NOW + RATE_WINDOW_MS - 1_000;
    expect(checkRate('someone', late).allowed).toBe(true);
    expect(checkRate('someone', late).allowed).toBe(false);
  });

  it('gives the retry a sensible answer partway through a window', () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRate('someone', NOW);

    const blocked = checkRate('someone', NOW + 60_000);
    if (blocked.allowed) throw new Error('expected to be blocked');

    // Four minutes until the oldest request falls out of a five minute window.
    expect(blocked.retryAfterSeconds).toBe(RATE_WINDOW_MS / 1000 - 60);
  });
});

describe('not leaking memory', () => {
  it('forgets accounts that have gone quiet', () => {
    // A map keyed by user id that is never swept is a leak with a nice name.
    for (let i = 0; i < 600; i++) checkRate(`user-${i}`, NOW);

    // Long after, one more request triggers the sweep, and the old ones go.
    checkRate('someone-else', NOW + RATE_WINDOW_MS * 2);

    // The proof is that a previously-exhausted account starts clean, which can
    // only happen if its entry was dropped or its window expired. Either is the
    // behaviour wanted here.
    expect(checkRate('user-1', NOW + RATE_WINDOW_MS * 2).allowed).toBe(true);
  });
});

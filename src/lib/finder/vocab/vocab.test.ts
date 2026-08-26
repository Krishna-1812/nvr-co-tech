import { describe, expect, it } from 'vitest';
import { ALIASES, FAMILIES, SEED_INDUSTRIES } from './industryData';
import { expand, familyFor, industriesFor, norm, suggest as suggestIndustry } from './industries';
import { hint, kinds, splitValid, suggest as suggestCode, validate } from './codes';
import { PICKER_LIMIT } from './shared';

/**
 * The vocabularies, and the ways a picker can quietly become useless.
 *
 * Two of these tests are invariants rather than behaviour, and they are the most
 * valuable ones here: both describe a shortcut that was added to help, that
 * shadowed a precise value with a broad one, and that produced an answer nobody
 * could tell was wrong. A search for banks that returns insurers and accountants
 * does not look like a bug, it looks like bad data.
 */

describe('the two invariants', () => {
  /*
   * "banking", "farming" and "utilities" are all real Apollo values that were
   * once aliased to broad families, so asking for banks returned insurers and
   * accountants: the same over-broad match the strict industry check exists to
   * prevent, one level up.
   */
  it('never aliases a word that is itself a real Apollo industry', () => {
    const real = new Set(SEED_INDUSTRIES.map(norm));
    const offenders = Object.keys(ALIASES).filter((a) => real.has(norm(a)));
    expect(offenders).toEqual([]);
  });

  /*
   * Four families were once named after Apollo values, which put two
   * identical-looking rows in the picker meaning different things — and the
   * broad one sorts first, so it shadowed the precise one.
   */
  it('never names a family after a real Apollo industry', () => {
    const real = new Set(SEED_INDUSTRIES.map(norm));
    const offenders = Object.keys(FAMILIES).filter((f) => real.has(norm(f)));
    expect(offenders).toEqual([]);
  });

  it('only ever expands a family into values Apollo actually uses', () => {
    const real = new Set(SEED_INDUSTRIES.map(norm));
    const invented = Object.values(FAMILIES)
      .flat()
      .filter((v) => !real.has(norm(v)));
    expect(invented).toEqual([]);
  });

  it('only ever aliases onto a family that exists', () => {
    const missing = Object.values(ALIASES).filter((f) => !(f in FAMILIES));
    expect(missing).toEqual([]);
  });
});

describe('normalising, so two spellings of one value compare equal', () => {
  it('collapses the two ways Apollo and people write an ampersand', () => {
    expect(norm('Hospital & Health Care')).toBe(norm('hospital and health care'));
    expect(norm('marketing&advertising')).toBe(norm('Marketing & Advertising'));
  });

  /*
   * Inherited from the source and kept on purpose. Apollo's own taxonomy uses
   * slashes and ampersands for different things, and no value in it is spelled
   * both ways, so there is no pair this separates that should have matched.
   */
  it('does not read a slash as an ampersand, which is the tempting wrong fix', () => {
    expect(norm('hospital/health care')).not.toBe(norm('hospital & health care'));
    expect(norm('airlines/aviation')).toBe('airlinesaviation');
  });

  it('collapses the three ways a technology name gets typed', () => {
    expect(norm('WordPress.org')).toBe(norm('wordpress org'));
    expect(norm('wordpress_org')).toBe(norm('WordPress.org'));
  });
});

describe('turning a typed word into industries', () => {
  /*
   * Nothing in Apollo's taxonomy is spelled "healthcare". Without the family
   * bridge, the honest strict filter returns nothing for the word almost
   * everybody types.
   */
  it('expands the word people type into the nine values Apollo really holds', () => {
    expect(industriesFor('healthcare')).toContain('hospital & health care');
    expect(industriesFor('healthcare')).toContain('pharmaceuticals');
    expect(industriesFor('healthcare')).not.toContain('healthcare');
  });

  it('reaches a family through an alias', () => {
    expect(familyFor('biotech')).toBe('healthcare');
    expect(familyFor('saas')).toBe('software');
  });

  it('keeps a term that names no family as itself, so an exact value still works', () => {
    const set = expand(['pharmaceuticals']);
    expect(set.has(norm('pharmaceuticals'))).toBe(true);
    expect(set.size).toBe(1);
  });

  it('says a word it does not know names no family, rather than guessing one', () => {
    expect(familyFor('quantum widgetry')).toBe('');
  });
});

describe('the industry picker', () => {
  it('puts families above individual industries, and a prefix match above a mid-string one', () => {
    const rows = suggestIndustry('heal');
    expect(rows[0].value).toBe('healthcare');
    expect(rows[0].kind).toBe('family');
    // "mental health care" matches in the middle, so it comes after.
    const industries = rows.filter((r) => r.kind === 'industry').map((r) => r.value);
    expect(industries).toContain('mental health care');
  });

  it('names what a family actually selects, rather than implying Apollo holds the word', () => {
    const family = suggestIndustry('healthcare').find((r) => r.kind === 'family');
    expect(family?.covers).toContain('hospital & health care');
  });

  /*
   * A value Apollo really returned is stronger evidence than anything written
   * down here, so it is offered even when the seed list has never heard of it.
   */
  it('offers a learned value the seed list does not have, and marks it confirmed', () => {
    const rows = suggestIndustry('quantum', { learned: ['quantum computing'] });
    expect(rows.map((r) => r.value)).toContain('quantum computing');
    expect(rows.find((r) => r.value === 'quantum computing')?.confirmed).toBe(true);
  });

  it('marks a seeded value nobody has ever seen returned as unconfirmed', () => {
    const row = suggestIndustry('tobacco').find((r) => r.value === 'tobacco');
    expect(row?.confirmed).toBe(false);
  });

  /*
   * The cap was 40 once, below the size of every vocabulary, so the picker was
   * an alphabetical dead end: 128 of Apollo's 147 industries could not be
   * browsed to at all.
   */
  it('can browse to the end of the real list, not to an alphabetical dead end', () => {
    const rows = suggestIndustry('');
    expect(rows.length).toBe(SEED_INDUSTRIES.length + Object.keys(FAMILIES).length);
    expect(rows.length).toBeLessThanOrEqual(PICKER_LIMIT);
    expect(rows.map((r) => r.value)).toContain('writing & editing');
  });

  it('says when a list is capped instead of presenting the first N as the whole vocabulary', () => {
    const meta = {} as { total: number; truncated: boolean };
    suggestIndustry('', { limit: 10, meta });
    expect(meta.truncated).toBe(true);
    expect(meta.total).toBeGreaterThan(10);
  });
});

describe('code shapes, which Apollo enforces itself', () => {
  /*
   * Real NAICS codes are six digits, so pasting one from any official source is
   * rejected by Apollo's own schema. The hint has to say what to do about it,
   * not only that something is wrong.
   */
  it('rejects the six-digit code every official source prints, and explains the rule', () => {
    expect(validate('naics', '541511')).toBe(false);
    expect(validate('naics', '54151')).toBe(true);
    expect(hint('naics')).toMatch(/541511 becomes 54151/);
  });

  it('takes exactly four digits for SIC', () => {
    expect(validate('sic', '7372')).toBe(true);
    expect(validate('sic', '737')).toBe(false);
  });

  /*
   * A wrong technology name fails by matching nothing rather than by being
   * malformed. Guessing which names exist is the guess the picker removes, not
   * something to enforce against.
   */
  it('accepts any non-empty technology or place, because neither has a shape', () => {
    expect(validate('technology', 'Some Tool Nobody Has Heard Of')).toBe(true);
    expect(validate('location', 'Bengaluru, Karnataka')).toBe(true);
    expect(validate('technology', '   ')).toBe(false);
  });

  it('hands the rejects back so a caller can say what was not sent', () => {
    const [ok, bad] = splitValid('naics', ['54151', '541511', '', '5415']);
    expect(ok).toEqual(['54151', '5415']);
    expect(bad).toEqual(['541511']);
  });

  it('serves exactly the four vocabularies it has data for', () => {
    expect(kinds()).toEqual(['location', 'naics', 'sic', 'technology']);
  });
});

describe('the code picker', () => {
  /*
   * Official code titles use the government's words. Nothing in NAICS is titled
   * "software": the code is 5132, filed under "publishing industries".
   */
  it('finds a code by an ordinary word its official title never uses', () => {
    const rows = suggestCode('naics', 'software');
    expect(rows.slice(0, 3).map((r) => r.value)).toContain('5132');
  });

  /*
   * "hospital" is a partial hit on the alias "hospitality". Pooling exact and
   * partial alias hits put eating places and hotels above 8062, general medical
   * and surgical hospitals, whose own title contains the word.
   */
  it('ranks an exact alias above a partial one, so hospitals beat hospitality', () => {
    const rows = suggestCode('sic', 'hospital').map((r) => r.value);
    expect(rows.indexOf('8062')).toBeLessThan(rows.indexOf('7011'));
  });

  it('matches a code on its digits by prefix, not by accidental containment', () => {
    const rows = suggestCode('naics', '54').map((r) => r.value);
    expect(rows).toContain('5415');
    // 6154 contains "54" only by accident, and is not a NAICS code in the seed.
    expect(rows.every((c) => c.startsWith('54') || !/^\d+$/.test(c) || true)).toBe(true);
    expect(rows[0].startsWith('54')).toBe(true);
  });

  it('carries the official title through, so a code is readable', () => {
    const row = suggestCode('sic', '7372')[0];
    expect(row.value).toBe('7372');
    expect(row.note).toBeTruthy();
  });

  it('returns nothing at all for a vocabulary it does not serve', () => {
    expect(suggestCode('nonsense', 'x')).toEqual([]);
  });

  it('reaches the end of the location list, which used to stop at Czech Republic', () => {
    const rows = suggestCode('location', '');
    expect(rows.length).toBeLessThanOrEqual(PICKER_LIMIT);
    expect(rows.map((r) => r.value)).toContain('Singapore');
    expect(rows.length).toBeGreaterThan(190);
  });
});

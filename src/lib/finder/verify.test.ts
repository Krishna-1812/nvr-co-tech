import { describe, expect, it, vi } from 'vitest';
import { numInRange, placeMatches, techMatches, verifyRows, VERIFY_LABELS } from './verify';
import {
  cleanSeniorities,
  deriveRole,
  displayName,
  functionSearchTitles,
  personFunctions,
  requestedFunctions,
  seniorityRank,
  SENIORITY_ORDER,
  titleFunctions,
  titleMatches,
} from './taxonomy';

vi.spyOn(console, 'info').mockImplementation(() => {});

/**
 * The verification pass and the taxonomy under it.
 *
 * This is the layer that decides what a search is allowed to claim, so the tests
 * are about what it refuses: a row it cannot check, a place abbreviation it
 * would otherwise read as a mismatch, a VP it would otherwise rank as C-suite, a
 * near-miss it would otherwise offer as the answer. Every one of these produced
 * an answer that looked fine and was wrong.
 */

describe('a row that cannot be checked', () => {
  /*
   * "I searched for Healthcare and got a venture firm" came from waving these
   * through. Failing closed is the safe direction.
   */
  it('is dropped, not waved through, when Apollo returned no figure to check', () => {
    const rows = [{ organization_employees: null }];
    const result = verifyRows(rows, { employee_min: 100 }, true);
    expect(result.kept).toEqual([]);
    expect(result.dropped.employees).toBe(1);
  });

  /*
   * The exception. Here "missing" describes an outage in OUR lookup, not
   * Apollo's classification, so rejecting the row would be asserting something
   * about a company we failed to look up.
   */
  it('is kept and counted apart when the employer lookup itself failed', () => {
    const rows = [{ employer_lookup_failed: true, organization_employees: null }];
    const result = verifyRows(rows, { employee_min: 100 }, true);
    expect(result.kept).toHaveLength(1);
    expect(result.employerUnavailable).toBe(1);
    expect(result.dropped).toEqual({});
  });

  it('still checks a failed-lookup row when no employer filter was asked for', () => {
    const rows = [{ employer_lookup_failed: true, title: 'Marketing Manager' }];
    const result = verifyRows(rows, { titles: ['CMO'], include_similar_titles: false }, true);
    expect(result.kept).toEqual([]);
    expect(result.dropped.title).toBe(1);
  });
});

describe('overlapping reason counts, which callers must not sum', () => {
  /*
   * Reporting only the first reason a fixed check order reached undercounted
   * how many rows a later filter was also responsible for.
   */
  it('tallies a row that failed two checks under both of them', () => {
    const rows = [{ organization_industry: 'banking', organization_employees: 5 }];
    const result = verifyRows(rows, { industries: ['healthcare'], employee_min: 100 }, true);

    expect(result.kept).toEqual([]);
    expect(result.dropped).toEqual({ industry: 1, employees: 1 });

    // The sum exceeds the real number of rows removed. That is the documented
    // behaviour, and the reason a caller must count rows rather than reasons.
    const summed = Object.values(result.dropped).reduce((a, b) => a + b, 0);
    expect(summed).toBe(2);
    expect(rows.length - result.kept.length).toBe(1);
  });
});

describe('the title checkbox', () => {
  /*
   * Leaving "include similar titles" checked is a request for Apollo's fuzzy
   * match. Overriding it here would make the checkbox do nothing.
   */
  it('does not re-check titles while similar titles are still included', () => {
    const rows = [{ title: 'Marketing Manager' }];
    expect(verifyRows(rows, { titles: ['CMO'] }, true).kept).toHaveLength(1);
    expect(
      verifyRows(rows, { titles: ['CMO'], include_similar_titles: false }, true).kept,
    ).toHaveLength(0);
  });
});

describe('places, and the state abbreviation that removed every row', () => {
  /*
   * "tx" does not appear in "Texas". Testing each comma-separated part as a raw
   * substring removed every row Apollo had already matched and reported them as
   * "headquartered elsewhere".
   */
  it('matches "Austin, TX" against a record holding Austin and Texas in separate fields', () => {
    const org = { city: 'Austin', state: 'Texas', country: 'United States' };
    expect(placeMatches(org, ['Austin, TX'])).toBe(true);
  });

  it('matches a bare state code, and a country code, in both directions', () => {
    expect(placeMatches({ state: 'Texas' }, ['TX'])).toBe(true);
    expect(placeMatches({ state: 'TX' }, ['Texas'])).toBe(true);
    expect(placeMatches({ country: 'United States' }, ['US'])).toBe(true);
  });

  /*
   * "CA" is California and Canada. Both readings are candidates, which is only
   * safe because every comma-separated part must match.
   */
  it('lets an ambiguous code reach Canada without also reaching Toronto, Ohio', () => {
    expect(placeMatches({ city: 'Toronto', country: 'Canada' }, ['Toronto, CA'])).toBe(true);
    expect(placeMatches({ city: 'Toronto', state: 'Ohio', country: 'United States' }, ['Toronto, CA'])).toBe(
      false,
    );
  });

  /*
   * "ma" sits inside "Massachusetts" and "ca" inside "California", so a
   * substring test passed those two by accident while failing every other state.
   */
  it('matches whole words, so the accidental passes stop too', () => {
    expect(placeMatches({ city: 'Chicago', state: 'Illinois' }, ['CA'])).toBe(false);
    expect(placeMatches({ city: 'Cambridge', state: 'Massachusetts' }, ['MA'])).toBe(true);
  });

  it('finds nothing in a record with no location at all, rather than everything', () => {
    expect(placeMatches({}, ['Texas'])).toBe(false);
  });
});

describe('technologies, taken as uids and returned as display names', () => {
  it('matches across the uid and display-name boundary', () => {
    const org = { technologies: ['Google Analytics', 'WordPress.org'] };
    expect(techMatches(org, ['google_analytics'])).toBe(true);
    expect(techMatches(org, ['WordPress.org'])).toBe(true);
    expect(techMatches(org, ['Segment'])).toBe(false);
  });
});

describe('numbers Apollo returned', () => {
  it('refuses a missing figure rather than treating it as in range', () => {
    expect(numInRange(null, 1, 100)).toBe(false);
    expect(numInRange('', 1, 100)).toBe(false);
  });

  it('accepts a zero, which is a real figure', () => {
    expect(numInRange(0, 0, 100)).toBe(true);
  });

  it('reads a one-sided bound as one-sided', () => {
    expect(numInRange(5000, 1000, null)).toBe(true);
    expect(numInRange(500, 1000, null)).toBe(false);
  });
});

describe('every reason a row can be removed has words for it', () => {
  it('names all nine, because a count with no reason is not an explanation', () => {
    expect(Object.keys(VERIFY_LABELS).sort()).toEqual([
      'company',
      'domain',
      'employees',
      'excluded_keyword',
      'hq',
      'industry',
      'revenue',
      'technology',
      'title',
    ]);
  });
});

// ─── The taxonomy ────────────────────────────────────────────────────────────

describe('seniority, and the VP that outranked the CEO', () => {
  /*
   * `titleTokens` expands "vp" into "vice president", so every VP carried the
   * c_suite token "president" and — c_suite being checked first — ranked as
   * C-suite. That put a VP of Sales level with the CEO.
   */
  it('never ranks a VP as C-suite, however their title is spelled', () => {
    const ceo = seniorityRank({ title: 'Chief Executive Officer' });
    for (const title of ['VP of Sales', 'Vice President, Sales', 'SVP Marketing']) {
      expect(seniorityRank({ title })).toBeGreaterThan(ceo);
      expect(SENIORITY_ORDER[seniorityRank({ title })]).not.toBe('c_suite');
    }
  });

  it("prefers Apollo's own assertion over reading the title", () => {
    expect(seniorityRank({ seniority: 'director', title: 'Chief Executive Officer' })).toBe(
      SENIORITY_ORDER.indexOf('director'),
    );
  });

  it('sorts an unplaceable title last rather than guessing a level for it', () => {
    expect(seniorityRank({ title: 'Sandwich Artist' })).toBe(SENIORITY_ORDER.length);
  });
});

describe('titles', () => {
  it('matches an abbreviation against the spelled-out title, and the reverse', () => {
    expect(titleMatches('Chief Marketing Officer (CMO)', ['CMO'])).toBe(true);
    expect(titleMatches('Global CMO', ['chief marketing officer'])).toBe(true);
  });

  /*
   * The whole reason the check exists. Apollo's fuzzy match returns this person
   * for a CMO search, and presenting them as the CMO states something Apollo
   * never said.
   */
  it('does not accept a Marketing Manager as the Chief Marketing Officer', () => {
    expect(titleMatches('Marketing Manager', ['CMO'])).toBe(false);
  });

  it('has nothing to say about a person with no title', () => {
    expect(titleMatches('', ['CMO'])).toBe(false);
  });
});

describe('functions, and who counts as a substitute for whom', () => {
  it('places a title in more than one function when it really spans two', () => {
    const f = titleFunctions('VP Finance & Operations');
    expect(f.has('finance')).toBe(true);
    expect(f.has('operations')).toBe(true);
  });

  it('classifies an unrecognisable title as nothing, rather than guessing', () => {
    expect(titleFunctions('Sandwich Artist').size).toBe(0);
  });

  /*
   * A revenue LEADER usually owns marketing. Their team does not: offering a
   * Revenue Operations Manager as the closest marketing contact is the exact
   * substitution the scoping exists to prevent.
   */
  it('offers a CRO to a marketing question but not a revenue ops manager', () => {
    expect(titleFunctions('Chief Revenue Officer').has('marketing')).toBe(true);
    expect(titleFunctions('Revenue Operations Manager').has('marketing')).toBe(false);
  });

  it('keeps the crossover one-directional', () => {
    // A marketing head is not an answer to a revenue question.
    expect(titleFunctions('Chief Marketing Officer').has('sales')).toBe(false);
  });

  /*
   * The only honest way to answer a question about the CEO: no keyword list
   * would place a Chief Creative Officer in "the executive team".
   */
  it('counts anyone at C-suite as executive, without making them finance', () => {
    const cco = personFunctions({ title: 'Chief Creative Officer' });
    expect(cco.has('executive')).toBe(true);
    expect(cco.has('finance')).toBe(false);
  });

  it("reads Apollo's own department as a second, independent signal", () => {
    const f = personFunctions({ title: 'Sandwich Artist', departments: ['master_finance'] });
    expect(f.has('finance')).toBe(true);
  });

  it('searches a function by its canonical titles, deduplicated and capped', () => {
    const titles = functionSearchTitles(['finance']);
    expect(titles).toContain('CFO');
    expect(new Set(titles).size).toBe(titles.length);
    expect(functionSearchTitles(['finance', 'marketing', 'sales'], 5)).toHaveLength(5);
  });

  it('reads the function a question asked about off its titles', () => {
    expect([...requestedFunctions(['CFO'])]).toContain('finance');
  });
});

describe('what a grid row may print beside a name', () => {
  it('omits the pair entirely when the title places nobody', () => {
    expect(deriveRole('Sandwich Artist')).toEqual({});
    expect(deriveRole('')).toEqual({});
  });

  /*
   * Printed as a chip, "executive" would both duplicate the seniority beside it
   * and read as a department nobody works in.
   */
  it('never prints "the executive team" as a function chip', () => {
    const role = deriveRole('Chief Executive Officer');
    expect(role.seniority_from_title).toBe('C-suite');
    expect(role.functions_from_title ?? []).not.toContain('the executive team');
  });

  it('renders a title with two functions in a stable order', () => {
    expect(deriveRole('VP Finance & Operations').functions_from_title).toEqual([
      'finance',
      'operations',
    ]);
  });
});

describe("seniority words a model produced, against Apollo's nine", () => {
  /*
   * Measured: one bad value in a list is skipped, but an ALL-BAD list returns
   * nothing. So "the executives at Acme" could answer "nobody matches" having
   * never asked Apollo anything.
   */
  it('rescues the spellings a model actually writes', () => {
    expect(cleanSeniorities(['C-Suite'])[0]).toEqual(['c_suite']);
    expect(cleanSeniorities(['executive'])[0]).toEqual(['c_suite']);
    expect(cleanSeniorities(['Executives'])[0]).toEqual(['c_suite']);
  });

  it('hands back what it had to drop, so an empty answer can say why', () => {
    const [kept, dropped] = cleanSeniorities(['c_suite', 'grandmaster']);
    expect(kept).toEqual(['c_suite']);
    expect(dropped).toEqual(['grandmaster']);
  });

  it('does not repeat a value reached by two different spellings', () => {
    expect(cleanSeniorities(['vp', 'SVP', 'Vice President'])[0]).toEqual(['vp']);
  });
});

describe('a surname Apollo withheld', () => {
  /*
   * The renderer treats **...** as bold, so two masked names in one sentence
   * made the text BETWEEN them bold. Escaping would keep "Sh***a" on screen, and
   * that is not a name anybody can use.
   */
  it('abbreviates rather than printing the mask, and invents no letters', () => {
    expect(displayName('Vivek Sh***a')).toBe('Vivek Sh.');
    expect(displayName('Meghana Ka***i')).toBe('Meghana Ka.');
  });

  it('leaves an unmasked name exactly as it is', () => {
    expect(displayName('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('drops a token whose mask leaves no letters, rather than printing a full stop', () => {
    expect(displayName('Ada ****')).toBe('Ada');
  });
});

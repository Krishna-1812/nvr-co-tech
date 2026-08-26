import { describe, expect, it } from 'vitest';
import { answerPerson, finish, trimFacts } from './answer';
import { EMPTY_INTENT, filtersFromIntent, normalizeIntent } from './intent';
import { extractJson } from './transport';
import { cleanUrl, stripTracking } from './urls';
import { panelFromFilters } from '@/components/finder/filters';

/**
 * The model layer's guarantees, none of which are a prompt.
 *
 * A prompt is a request. Everything tested here is a rule the code keeps
 * regardless of what came back: what a filter may be set to, what an answer may
 * carry, what a URL may point at. Each of them exists because a model, asked
 * nicely in prose, did the other thing.
 */

describe('narrowing a parse to filters', () => {
  /*
   * The keyword parameter is a LITERAL text match, so nobody's title reads "top
   * executives", and ANDed against a correct seniority filter it guarantees zero
   * rows rather than narrowing anything. Reported live from one request that had
   * everything else right.
   */
  it('drops a seniority word that came back dressed as a keyword', () => {
    const filters = filtersFromIntent({
      ...EMPTY_INTENT,
      seniorities: ['c_suite', 'vp'],
      keywords: 'top executives',
    });
    expect(filters.keywords).toBeUndefined();
    expect(filters.seniorities).toEqual(['c_suite', 'vp']);
  });

  it('keeps a keyword that is actually a keyword', () => {
    const filters = filtersFromIntent({ ...EMPTY_INTENT, keywords: 'Series B' });
    expect(filters.keywords).toBe('Series B');
  });

  /*
   * The parser answers a chat question and carries chat-shaped fields too. Any
   * of them reaching the panel would set a filter somebody cannot see, which is
   * the one thing this must never do.
   */
  it('never passes a chat-shaped field through to the panel', () => {
    const filters = filtersFromIntent({
      ...EMPTY_INTENT,
      intent: 'person_at_company',
      titles: ['CMO'],
      wants_contact_info: true,
      max_results: 50,
    });
    expect(Object.keys(filters).sort()).toEqual(['titles']);
  });

  it('sends a company as typed, for the resolver to settle', () => {
    const filters = filtersFromIntent({ ...EMPTY_INTENT, company_name: 'Thoughtworks' });
    expect(filters.company_domains).toEqual(['Thoughtworks']);
  });
});

describe('reading a parse the model got loose about', () => {
  it('refuses an intent name it does not recognise', () => {
    expect(normalizeIntent({ intent: 'find_everything' }).intent).toBe('unclear');
  });

  it('drops blanks and duplicates from every list', () => {
    expect(normalizeIntent({ titles: ['CMO', '', ' CMO ', 'CTO'] }).titles).toEqual(['CMO', 'CTO']);
  });

  it('refuses an email status outside the two usable values', () => {
    expect(normalizeIntent({ email_status: 'likely_to_engage' }).email_status).toBe('');
    expect(normalizeIntent({ email_status: 'verified' }).email_status).toBe('verified');
  });

  it('keeps a numeric bound as a number and a missing one as null', () => {
    const intent = normalizeIntent({ employee_min: '500', employee_max: null });
    expect(intent.employee_min).toBe(500);
    expect(intent.employee_max).toBeNull();
  });
});

describe('putting a parse on a panel that may not have the control', () => {
  /*
   * A filter with no control is a filter nobody can remove, and the parser is
   * allowed to be wrong. Dropped and named, rather than carried invisibly.
   */
  it('leaves out a value this tab has no control for, and says which', () => {
    const out = panelFromFilters('companies', { titles: ['CMO'], industries: ['healthcare'] });
    expect(out.values.titles).toBeUndefined();
    expect(out.values.industries).toEqual(['healthcare']);
    expect(out.ignored).toContain('Job titles');
  });

  it('moves a place onto whichever control this tab calls it', () => {
    const out = panelFromFilters('companies', { person_locations: ['Texas'] });
    expect(out.values.locations).toEqual(['Texas']);
  });

  /*
   * The size selector offers seven fixed bands and "200 to 500" fits none of
   * them. Rounding to the nearest band would answer a slightly different
   * question without saying so.
   */
  it('keeps an exact headcount range rather than rounding it to a band', () => {
    const out = panelFromFilters('people', { employee_min: 200, employee_max: 500 });
    expect(out.values.employee_min).toBe(200);
    expect(out.values.employee_max).toBe(500);
    expect(out.set).toContain('Employees from');
  });

  it('gives the single "at company" box a string, not the list the search takes', () => {
    const out = panelFromFilters('people', { company_domains: ['Acme'] });
    expect(out.values.company_domains).toBe('Acme');
  });
});

describe('what an answer is allowed to say', () => {
  /*
   * Deliberately an allowlist. The profile shape returns FOUR keys carrying
   * contact data, and a denylist naming only two quietly handed the other two to
   * the model on every answer, including ones where nobody asked for an address.
   */
  it('withholds every contact field when contact details were not asked for', () => {
    const profile = {
      matched: true,
      name: 'Ada',
      email: 'a@x.com',
      apollo_email: 'a@x.com',
      emails: [{ email: 'a@x.com' }],
      phones: [{ number: '+1' }],
    };
    expect(Object.keys(answerPerson(profile, false)).sort()).toEqual(['matched', 'name']);
  });

  it('includes all four of them when they were', () => {
    const profile = { name: 'Ada', email: 'a@x.com', apollo_email: '', emails: [], phones: [] };
    expect(Object.keys(answerPerson(profile, true)).sort()).toEqual([
      'apollo_email',
      'email',
      'emails',
      'name',
      'phones',
    ]);
  });

  /*
   * Truncating a JSON blob mid-string hands the model a malformed object it has
   * to guess the rest of. This drops whole fields instead.
   */
  it('shrinks the facts at field boundaries, never mid-value', () => {
    const trimmed = trimFacts({
      people: Array.from({ length: 20 }, (_, i) => ({ name: `p${i}` })),
      person: { name: 'Ada', keywords: ['a'], history: [1, 2, 3] },
      keywords: ['x'],
      total_matching_count: 400,
    });

    expect((trimmed.people as unknown[]).length).toBe(6);
    expect(trimmed.person).toEqual({ name: 'Ada' });
    expect(trimmed.keywords).toBeUndefined();
    // The counts survive: they are what the answer is built on.
    expect(trimmed.total_matching_count).toBe(400);
  });
});

describe('cleaning what a web-searching model cites', () => {
  it('removes a tracking parameter the search tool added', () => {
    expect(cleanUrl('https://acme.com/team?utm_source=openai')).toBe('https://acme.com/team');
  });

  it('keeps a real query parameter beside a tracking one', () => {
    expect(cleanUrl('https://acme.com/s?q=cmo&fbclid=abc')).toBe('https://acme.com/s?q=cmo');
  });

  /*
   * `ref` and `source` carry real routing meaning on some sites, and rewriting a
   * URL into one that serves different content is a worse bug than the one being
   * fixed.
   */
  it('leaves an ambiguous parameter alone', () => {
    const url = 'https://acme.com/p?ref=partner';
    expect(cleanUrl(url)).toBe(url);
  });

  it('returns anything that is not a URL exactly as given', () => {
    expect(cleanUrl('not a url')).toBe('not a url');
    expect(cleanUrl('mailto:a@x.com')).toBe('mailto:a@x.com');
  });

  it('does not swallow the full stop at the end of a sentence', () => {
    expect(stripTracking('See https://acme.com/x?utm_source=openai.')).toBe(
      'See https://acme.com/x.',
    );
  });

  it('does not swallow a closing bracket around a citation', () => {
    expect(stripTracking('(https://acme.com/x?fbclid=1)')).toBe('(https://acme.com/x)');
  });
});

describe('finishing an answer', () => {
  it('collapses an em dash without leaving a space before the comma', () => {
    expect(finish('Ada is the CMO — she joined in 2024.')).toBe(
      'Ada is the CMO, she joined in 2024.',
    );
  });

  it('cleans a tracking parameter wherever in the pipeline it came from', () => {
    expect(finish('Per https://acme.com/team?utm_campaign=x she leads marketing.')).toBe(
      'Per https://acme.com/team she leads marketing.',
    );
  });
});

describe('reading JSON out of prose', () => {
  it('finds the object inside a fenced code block', () => {
    expect(extractJson('```json\n{"found": true}\n```')).toEqual({ found: true });
  });

  it('finds it after a sentence the model added anyway', () => {
    expect(extractJson('Here is what I found:\n{"found": false}')).toEqual({ found: false });
  });

  it('returns null rather than throwing on a reply with no object in it', () => {
    expect(extractJson('I could not confirm this.')).toBeNull();
    expect(extractJson('[1, 2, 3]')).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { cleanCompanyName, probeCompanyFree, resolveCompanyDirect } from './company';
import { renderFullProfile } from './fullProfile';
import {
  contactBrief,
  nameIncomplete,
  personNameMatches,
  sameFunctionPeople,
  verifyChatPeople,
} from './people';
import {
  CHAT_BACKREF,
  asksAboutAPopulation,
  chatCodes,
  constraintNote,
  namesCompany,
  rangeWords,
  rejectNote,
} from './scope';
import { EMPTY_INTENT, type Intent } from '../llm/intent';
import { personProfile } from '../profile';
import { newSpend } from '../store';

/**
 * The conversation's guards.
 *
 * Every one of these exists because a chat answer makes it very easy to lose one
 * distinction: what our records say, and what is true. "Nobody on file holds
 * that title" is a fact about a database; "the role is vacant" is a fact about a
 * company. These tests are the places that distinction was once lost.
 */

type Reply = Record<string, unknown>;
let queue: Reply[] = [];

function stubApollo(replies: Reply[]) {
  queue = [...replies];
  vi.stubGlobal('fetch', async () => {
    const next = queue.shift() ?? {};
    return new Response(JSON.stringify(next), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function fakeSupabase(): SupabaseClient<Database> {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'gt', 'eq', 'order', 'limit']) builder[method] = () => builder;
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });

  return {
    from: () => builder,
    rpc: async () => ({ data: null, error: null }),
  } as unknown as SupabaseClient<Database>;
}

const intent = (over: Partial<Intent>): Intent => ({ ...EMPTY_INTENT, ...over });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('one conversation asking two different questions', () => {
  /*
   * The bug: "list VPs of Sales at healthcare companies in Texas" answered
   * "nobody in sales at Snowflake", because Snowflake was pinned by the question
   * before it and a pinned company suppresses the industry, HQ, size and
   * technology filters entirely.
   */
  it('reads a question about an industry as being about a set of companies', () => {
    expect(asksAboutAPopulation(intent({ industries: ['healthcare'] }))).toBe(true);
    expect(asksAboutAPopulation(intent({ employee_min: 500 }))).toBe(true);
    expect(asksAboutAPopulation(intent({ naics_codes: ['5415'] }))).toBe(true);
  });

  /*
   * person_locations constrains where the PEOPLE are, not which companies they
   * work for, so "any of them in Texas?" is a legitimate follow-up about the
   * company already being discussed.
   */
  it('does not count where the people are as a question about companies', () => {
    expect(asksAboutAPopulation(intent({ person_locations: ['Texas'] }))).toBe(false);
    expect(asksAboutAPopulation(intent({ titles: ['CMO'] }))).toBe(false);
  });

  it('lets a follow-up pointing back at the pinned company through', () => {
    for (const message of [
      'do they have a CFO',
      'is it in healthcare',
      'who else works there',
      'what does that company do',
    ]) {
      expect(CHAT_BACKREF.test(message)).toBe(true);
    }
  });

  /*
   * English also uses "there" as a bare placeholder, and this is exactly the
   * question the guard exists to let through: reading that "there" as a
   * reference would put the previous company straight back on the search.
   */
  it('does not read a bare placeholder "there" as pointing at a company', () => {
    expect(CHAT_BACKREF.test('are there any healthcare companies in Texas')).toBe(false);
  });

  it('sees a company the message actually names, however the parser respelled it', () => {
    expect(namesCompany('who is the CMO of snowflake', 'Snowflake Inc.')).toBe(true);
    expect(namesCompany('who is the CMO of snowflke', 'Snowflake', 'snowflke')).toBe(true);
  });

  /*
   * The normaliser strips "co" and "company" to a bare token, so a substring
   * test reads "co" out of the middle of "coffee" and concludes somebody named a
   * company they never mentioned.
   */
  it('does not find a company name inside an unrelated word', () => {
    expect(namesCompany('list coffee roasters in Texas', 'Co')).toBe(false);
    expect(namesCompany('list coffee roasters in Texas', 'The Co Company')).toBe(false);
  });
});

describe('checking a list actually answers the question', () => {
  const vpSales = { title: 'VP of Sales' };
  const accountExec = { title: 'Account Executive' };
  const financeDirector = { title: 'Director of Finance' };
  const engineeringVp = { title: 'VP of Engineering' };

  /*
   * "list the VPs of sales at Acme" could answer with account executives: the
   * same error the one-person path was hardened against, printed five times.
   */
  it('drops somebody whose title is nowhere near the one asked for', () => {
    const out = verifyChatPeople([vpSales, accountExec], ['VP of Sales']);
    expect(out.kept).toEqual([vpSales]);
    expect(out.dropped).toBe(1);
  });

  /*
   * Asking for the VP of Finance is asking about finance leadership, so the
   * finance director belongs even though no title string matches word for word.
   */
  it('keeps somebody at the same level in the same function', () => {
    const out = verifyChatPeople([financeDirector], ['VP of Finance']);
    expect(out.kept).toEqual([financeDirector]);
  });

  /*
   * Both halves are needed. Function alone is far too wide — an account
   * executive sits in sales exactly as a VP of Sales does — and seniority alone
   * is what made an earlier consolation list offer senior strangers from
   * unrelated departments.
   */
  it('needs both halves: the right function AND a senior enough title', () => {
    expect(verifyChatPeople([accountExec], ['VP of Sales']).kept).toEqual([]);
    expect(verifyChatPeople([engineeringVp], ['VP of Sales']).kept).toEqual([]);
  });

  it('checks nothing when no title was asked for, rather than dropping everyone', () => {
    const out = verifyChatPeople([accountExec, engineeringVp], []);
    expect(out.kept).toHaveLength(2);
    expect(out.dropped).toBe(0);
  });
});

describe('a name that is not yet a name', () => {
  /*
   * Three ways a free row falls short, and all three have to count or the reveal
   * skips the person it exists for.
   */
  it('catches a flagged mask, a missing name, and a first name with no surname', () => {
    expect(nameIncomplete({ full_name: 'Vivek Sh***a', name_masked: true })).toBe(true);
    expect(nameIncomplete({})).toBe(true);
    // The case the feature was built for: no masking flag at all.
    expect(nameIncomplete({ full_name: 'Sanjeev' })).toBe(true);
  });

  it('leaves a complete name alone', () => {
    expect(nameIncomplete({ full_name: 'Ada Lovelace', last_name: 'Lovelace' })).toBe(false);
  });

  it('abbreviates a masked surname in a brief rather than printing asterisks', () => {
    const brief = contactBrief({ full_name: 'Vivek Sh***a', title: 'CFO', name_masked: true });
    expect(brief.name).toBe('Vivek Sh.');
    expect(brief.surname_withheld_until_enriched).toBe(true);
    // A bare list of names is useless to a reader who has to know how close each
    // person is to the role they asked about.
    expect(brief.title).toBe('CFO');
  });
});

describe('is this the person public research named', () => {
  it('matches a middle initial but not a different surname', () => {
    expect(personNameMatches('Heidi A. Bullock', 'Heidi Bullock')).toBe(true);
    expect(personNameMatches('Heidi Chen', 'Heidi Bullock')).toBe(false);
  });

  it('refuses a one-word name, which does not identify anybody', () => {
    expect(personNameMatches('Heidi Bullock', 'Heidi')).toBe(false);
  });

  /*
   * A masked row cannot be confirmed to be the right person, and the caller
   * offers a reveal for exactly that case.
   */
  it('refuses a masked candidate rather than assuming', () => {
    expect(personNameMatches('Heidi B.', 'Heidi Bullock')).toBe(false);
  });

  it('folds accents, so the same person spelled two ways is one person', () => {
    expect(personNameMatches('José García', 'Jose Garcia')).toBe(true);
  });

  it('ignores an honorific or a suffix', () => {
    expect(personNameMatches('Dr. Ada Lovelace Jr.', 'Ada Lovelace')).toBe(true);
  });
});

describe('which company did they mean', () => {
  it('splits a domain the parser tacked onto a name', () => {
    expect(cleanCompanyName('Position2 (position2.com)')).toEqual({
      name: 'Position2',
      domain: 'position2.com',
    });
    expect(cleanCompanyName('acme.com')).toEqual({ name: 'acme.com', domain: 'acme.com' });
    expect(cleanCompanyName('Acme Corp')).toEqual({ name: 'Acme Corp', domain: '' });
  });

  /*
   * The free probe guesses a domain, and the guard against answering about the
   * wrong business is that the vendor's OWN employer name must normalise exactly
   * equal to the typed name.
   */
  it('pins a company for nothing when the employer name matches exactly', async () => {
    stubApollo([
      {
        people: [
          {
            id: 'p1',
            first_name: 'Ada',
            last_name: 'Lovelace',
            organization: { id: 'o1', name: 'Tealium', primary_domain: 'tealium.com' },
          },
        ],
      },
    ]);

    const org = await probeCompanyFree('Tealium', 'k');
    expect(org).toEqual({ id: 'o1', name: 'Tealium', primary_domain: 'tealium.com' });
  });

  it('refuses a near-miss, so "Delta" does not become Delta Air Lines', async () => {
    stubApollo([
      {
        people: [
          {
            id: 'p1',
            first_name: 'Ada',
            last_name: 'Lovelace',
            organization: { id: 'o1', name: 'Delta Air Lines', primary_domain: 'delta.com' },
          },
        ],
      },
    ]);

    expect(await probeCompanyFree('Delta', 'k')).toBeNull();
  });

  /*
   * The domain parameter is a fuzzy search input rather than a strict equality
   * filter, so taking the first hit hands back a neighbouring company that
   * shares nothing with the requested domain.
   */
  it('accepts a domain hit only when the domain actually matches', async () => {
    stubApollo([{ organizations: [{ id: 'o9', name: 'Acme Neighbour', primary_domain: 'acme-inc.com' }] }]);

    const spend = newSpend();
    const out = await resolveCompanyDirect(fakeSupabase(), '', 'k', 'acme.com', spend);

    expect(out.org).toBeNull();
    expect(out.choices).toBeNull();
    /*
     * And it still cost a credit. Apollo bills a call that returns at least one
     * row; the row we then reject for the wrong domain is rejected on our side
     * and is not refunded. Billing off the surviving count made exactly this
     * case read as free, and it is also why this particular miss is deliberately
     * not cached.
     */
    expect(spend.credits).toBe(1);
  });

  it('charges nothing at all when Apollo itself returned nothing', async () => {
    stubApollo([{ organizations: [] }]);

    const spend = newSpend();
    await resolveCompanyDirect(fakeSupabase(), 'Nobody Ltd', 'k', '', spend);
    expect(spend.credits).toBe(0);
  });

  it('resolves one exact name rather than asking which of several', async () => {
    stubApollo([
      {
        organizations: [
          { id: 'o1', name: 'Acme', primary_domain: 'acme.com' },
          { id: 'o2', name: 'Acme Logistics', primary_domain: 'acmelog.com' },
        ],
      },
    ]);

    const out = await resolveCompanyDirect(fakeSupabase(), 'Acme', 'k', '', newSpend());
    expect(out.org?.id).toBe('o1');
    expect(out.choices).toBeNull();
  });

  it('asks which one when two distinct companies are equally plausible', async () => {
    stubApollo([
      {
        organizations: [
          { id: 'o1', name: 'Apex Systems', primary_domain: 'apexsystems.com' },
          { id: 'o2', name: 'Apex Global', primary_domain: 'apexglobal.com' },
        ],
      },
    ]);

    const out = await resolveCompanyDirect(fakeSupabase(), 'Apex', 'k', '', newSpend());
    expect(out.org).toBeNull();
    expect(out.choices).toHaveLength(2);
  });

  it('never asks somebody to choose between duplicates of one company', async () => {
    stubApollo([
      {
        organizations: [{ id: 'o1', name: 'Acme', primary_domain: 'acme.com' }],
        accounts: [{ id: 'a1', organization_id: 'o1', name: 'Acme', domain: 'acme.com' }],
      },
    ]);

    const out = await resolveCompanyDirect(fakeSupabase(), 'Acme', 'k', '', newSpend());
    expect(out.choices).toBeNull();
    expect(out.org).not.toBeNull();
  });
});

describe('offering the nearest contacts instead of an answer', () => {
  /*
   * A question about the CFO used to come back with six unrelated executives.
   * The search runs with similar titles included, so it is a recall net rather
   * than a guarantee, and the code-side check is what makes it an answer.
   */
  it('keeps only people actually in the function that was asked about', async () => {
    stubApollo([
      {
        people: [
          { id: '1', title: 'Chief Financial Officer' },
          { id: '2', title: 'VP of Engineering' },
          { id: '3', title: 'Finance Manager' },
        ],
      },
    ]);

    const out = await sameFunctionPeople('o1', new Set(['finance']), 'k');
    expect(out.map((p) => p.title)).toEqual(['Chief Financial Officer', 'Finance Manager']);
  });

  it('puts the seniors first, so the nearest contact reads first', async () => {
    stubApollo([
      {
        people: [
          { id: '1', title: 'Finance Manager' },
          { id: '2', title: 'Chief Financial Officer' },
        ],
      },
    ]);

    const out = await sameFunctionPeople('o1', new Set(['finance']), 'k');
    expect(out[0].title).toBe('Chief Financial Officer');
  });
});

describe('saying which constraints were applied', () => {
  it('puts the employer constraints in plain words', () => {
    expect(
      constraintNote({
        industries: ['healthcare'],
        locations: ['Texas'],
        employee_min: 200,
        employee_max: 500,
      }),
    ).toEqual({
      industry: 'healthcare',
      headquarters: 'Texas',
      employees: '200 to 500',
    });
  });

  it('reads an open-ended band as open-ended', () => {
    expect(rangeWords(1000, null)).toBe('1000 or more');
    expect(rangeWords(null, 50)).toBe('up to 50');
    expect(rangeWords(null, null)).toBe('');
  });

  it('names removal reasons in the same words the on-screen banner uses', () => {
    expect(rejectNote({ industry: 3, employees: 7 })).toEqual({
      'outside the size range': 7,
      'outside the industry': 3,
    });
  });

  /*
   * NAICS is taken at two to five digits, so a question quoting a real six-digit
   * code would otherwise be answered with an empty page and no explanation.
   */
  it('separates a code that is the wrong length rather than sending it', () => {
    const out = chatCodes(intent({ naics_codes: ['5415', '541511'] }));
    expect(out.filters.naics_codes).toEqual(['5415']);
    expect(out.rejected.naics.codes).toEqual(['541511']);
    expect(out.rejected.naics.hint).toMatch(/digits/i);
  });
});

describe('the record a credit bought, rendered in code', () => {
  it('prints every field, including the contact details that were paid for', () => {
    const profile = personProfile({
      id: 'p1',
      name: 'Ada Lovelace',
      title: 'CTO',
      email: 'ada@acme.com',
      email_status: 'verified',
      phone_numbers: [{ sanitized_number: '+918047181000' }],
      city: 'Bengaluru',
      country: 'India',
      organization: { id: 'o1', name: 'Acme', primary_domain: 'acme.com', estimated_num_employees: 400 },
    });

    const text = renderFullProfile(profile);
    expect(text).toContain('**Name:** Ada Lovelace');
    expect(text).toContain('**Email:** ada@acme.com (verified)');
    expect(text).toContain('**Phone:** +918047181000');
    expect(text).toContain('**Location:** Bengaluru, India');
    expect(text).toContain('Everything we hold on the company:');
    expect(text).toContain('**Employees:** 400');
  });

  it('leaves out what was never returned rather than printing an empty label', () => {
    const text = renderFullProfile(personProfile({ id: 'p1', name: 'Ada Lovelace' }));
    expect(text).toContain('**Name:** Ada Lovelace');
    expect(text).not.toContain('**Email:**');
    expect(text).not.toContain('Everything we hold on the company:');
  });

  it('says nothing at all when there was no match', () => {
    expect(renderFullProfile(null)).toBe('');
  });
});

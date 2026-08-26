import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { searchPeople } from '../apollo/client';
import type { ApolloRecord, PeopleFilters, SearchMeta } from '../apollo/types';
import { enrichCompanyProfile, enrichPerson } from '../enrich';
import { answerPerson, groundedAnswer, type Facts } from '../llm/answer';
import { parseIntent, verifyIntent, type Intent } from '../llm/intent';
import { research as runResearch, roleLookup, type RoleHolder } from '../llm/lookup';
import type { Message } from '../llm/transport';
import type { Choice } from '../resolve';
import { normName } from '../resolve';
import { companyRow } from '../rows';
import { newSpend, type Spend } from '../store';
import {
  cleanSeniorities,
  functionLabel,
  requestedFunctions,
  titleMatches,
} from '../taxonomy';
import {
  companyNote,
  probeCompanyFree,
  resolveCompany,
  type ResolveNotes,
} from './company';
import { renderFullProfile } from './fullProfile';
import {
  CHIP_CAP,
  contactBrief,
  displayPeople,
  displayPerson,
  enrichChip,
  nameIncomplete,
  personOnFile,
  revealNames,
  sameFunctionPeople,
  verifyChatPeople,
  type EnrichChip,
} from './people';
import {
  CHAT_BACKREF,
  asksAboutAPopulation,
  chatCodes,
  chatEmployerFilters,
  companyScope,
  constraintNote,
  hasEmployerConstraints,
  namesCompany,
  rejectNote,
  unknownVocabValues,
} from './scope';

/**
 * The conversation.
 *
 * **Stateless**: the browser resends the whole conversation each turn, so "the
 * second one" resolves against a list from a prior turn without any server-side
 * session. Parsing what somebody wants is one model call; **which lookups to
 * make, and whether a name is ambiguous, is decided in plain code and never left
 * to the model.**
 *
 * Everything below is arranged around one distinction that a chat answer makes
 * very easy to lose: what our records say, and what is true. "Nobody on file
 * holds that title" is a fact about a database. "The role is vacant" is a fact
 * about a company. The first is often worth saying and the second is almost
 * never ours to say, and the machinery here — the sibling retry, the on-file
 * check, the incomplete-check flag — exists so the answer can tell them apart.
 */

type Client = SupabaseClient<Database>;
type Person = Record<string, unknown>;

export type ChatContext = { org_id: string; name: string; domain: string };

export type ChatRequest = {
  message: string;
  history: Message[];
  /** A company picked from a disambiguation list on the previous turn. */
  selected_org_id?: string;
  selected_domain?: string;
  selected_name?: string;
  /** The company pinned by an earlier pick in this conversation. */
  context_org_id?: string;
  context_domain?: string;
  context_name?: string;
};

export type ChatReply = {
  answer: string;
  choices?: Choice[];
  context?: ChatContext | null;
  /** Forget the pinned company: this turn stopped being about it. */
  clear_context?: true;
  /** Always a list, in every branch, so the browser has one shape to render. */
  enrich?: EnrichChip[];
  credits?: number;
  researched?: boolean;
  /** False with `researched` true means background knowledge, no live web. */
  web_search?: boolean;
};

/** How long research may hold up an answer that is otherwise ready. */
const RESEARCH_WAIT_MS = 55_000;

/**
 * Research is an **enhancement**, so a slow one degrades the answer rather than
 * failing it. Started before every branch that answers, collected wherever the
 * answer is assembled.
 */
function startResearch(question: string, note: string): () => Promise<{ text: string; web: boolean }> {
  const promise = runResearch(question, note)
    .then((r) => ({ text: r.text, web: r.sources.length > 0 }))
    .catch(() => ({ text: '', web: false }));

  return () =>
    Promise.race([
      promise,
      new Promise<{ text: string; web: boolean }>((resolve) =>
        setTimeout(() => resolve({ text: '', web: false }), RESEARCH_WAIT_MS),
      ),
    ]);
}

const s = (v: unknown): string => String(v ?? '').trim();

export async function runChat(
  supabase: Client,
  apiKey: string,
  req: ChatRequest,
): Promise<ChatReply> {
  const message = req.message.slice(0, 600);
  const history = req.history.slice(-12).map((h) => ({
    role: h.role,
    content: String(h.content ?? '').slice(0, 2000),
  }));

  // Accumulates every billable call made answering this one question, so the
  // reply can say what it cost.
  const spend: Spend = newSpend();
  let clearContext = false;

  const reply = (fields: Omit<ChatReply, 'credits' | 'clear_context'>): ChatReply => {
    const out: ChatReply = { ...fields };
    if (spend.credits) out.credits = spend.credits;
    /*
     * This turn stopped being about the company the browser had pinned, so tell
     * it to forget that company. Set from here rather than from the branch that
     * decided it, because any branch can be the one that answers. Skipped when
     * the reply carries a company of its own: that supersedes the old pin
     * already, and sending both would be telling the browser two things at once.
     */
    if (clearContext && !fields.context) out.clear_context = true;
    return out;
  };

  // ── 1. Parse, then have it reviewed ──────────────────────────────────────
  let intent: Intent;
  try {
    const first = await parseIntent(message, history);
    intent = await verifyIntent(message, first, history);
  } catch (error) {
    console.warn(
      `finder: chat intent parse failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return reply({ answer: "I could not read that. Try rephrasing it." });
  }

  let kind: Intent['intent'] = intent.intent;
  let companyName = intent.company_name;
  let typedCompany = intent.company_name_typed;

  const titles = intent.titles.slice(0, 8);
  /*
   * Normalised against the vendor's own nine values, because that list is
   * closed and case-sensitive: an all-unrecognised list makes the search return
   * nothing, which the answer would then report as nobody matching.
   */
  const [seniorities, seniorityDropped] = cleanSeniorities(intent.seniorities.slice(0, 8));
  const wantsContact = intent.wants_contact_info;
  const maxResults = Math.min(intent.max_results, 20);

  const selectedOrgId = s(req.selected_org_id).slice(0, 64);
  const selectedDomain = s(req.selected_domain).toLowerCase().slice(0, 120);
  const selectedName = s(req.selected_name).slice(0, 200);
  let contextOrgId = s(req.context_org_id).slice(0, 64);
  let contextDomain = s(req.context_domain).toLowerCase().slice(0, 120);
  let contextName = s(req.context_name).slice(0, 200);

  const hasPick = Boolean(selectedOrgId || selectedDomain);

  // ── 3. One conversation, two different questions ─────────────────────────
  /*
   * A company stays pinned across turns so "and their VP of Sales?" does not
   * have to name it again. That inheritance is wrong the moment somebody stops
   * asking about that company and starts asking about a POPULATION of companies.
   *
   * Both routes into that state are closed here, in code rather than by asking
   * the parser to be careful: the pin the browser sent, and a company name the
   * parser lifted out of the conversation history.
   */
  if (asksAboutAPopulation(intent) && !hasPick && !CHAT_BACKREF.test(message)) {
    if (companyName && !namesCompany(message, companyName, typedCompany)) {
      console.info('finder: chat dropped a carried-over company, this asks about a population');
      companyName = '';
      typedCompany = '';
    }
    if (contextOrgId && !namesCompany(message, contextName)) {
      console.info('finder: chat unpinned a company, this asks about a population');
      contextOrgId = '';
      contextDomain = '';
      contextName = '';
      // The browser keeps the pin until told otherwise, so without this the
      // very next turn re-sends the company just dropped.
      clearContext = true;
    }
  }

  // ── 4. Nothing to look up is not nothing to answer ───────────────────────
  if (kind === 'unclear' && titles.length === 0 && !companyName && !hasPick) {
    const research = await runResearch(message);
    if (research.text) {
      return reply({
        researched: true,
        web_search: research.sources.length > 0,
        answer: await groundedAnswer({}, message, research.text),
      });
    }
    return reply({
      answer:
        'I could not research that just now. I can also look up who holds a role at a company, a list of people by title or industry, or a company profile.',
    });
  }

  // ── 5. Resolve the company, cheapest path first ──────────────────────────
  let resolvedOrg: ApolloRecord | null = null;
  const resolveNotes: ResolveNotes = {};

  if (selectedOrgId) {
    // An explicit pick off a list already fetched. Trusted directly: no search,
    // no credit, no chance of re-disambiguating the same choice.
    resolvedOrg = { id: selectedOrgId, name: selectedName || companyName, primary_domain: selectedDomain };
  } else if (contextOrgId && (!companyName || normName(companyName) === normName(contextName))) {
    // The company already pinned earlier, either because this turn named none
    // at all or because it named the same ambiguous one again.
    resolvedOrg = { id: contextOrgId, name: contextName, primary_domain: contextDomain };
  } else if (companyName || selectedDomain) {
    /*
     * Try to pin the company for free before paying to. People questions only:
     * a company_info question needs the firmographics only the paid record
     * carries, so probing first would just delay a call that has to happen.
     */
    if (companyName && !selectedDomain && kind !== 'company_info') {
      resolvedOrg = (await probeCompanyFree(companyName, apiKey)) as ApolloRecord | null;
    }

    if (!resolvedOrg) {
      let resolution;
      try {
        resolution = await resolveCompany(supabase, companyName, apiKey, {
          domain: selectedDomain,
          spend,
          notes: resolveNotes,
        });
      } catch (error) {
        // Apollo was unreachable. Saying "no such company" here would assert a
        // negative fact that was never established.
        console.warn(
          `finder: chat company resolve failed: ${error instanceof Error ? error.message : 'unknown'}`,
        );
        return reply({
          answer:
            "I could not reach our records just now, so I cannot confirm anything about that company yet. Try again in a moment.",
        });
      }

      if (resolution.choices && resolution.choices.length > 0) {
        return reply({
          answer: `I found a few companies matching “${companyName || selectedDomain}”. Which did you mean?`,
          choices: resolution.choices,
        });
      }

      if (!resolution.org) {
        /*
         * Not in our records is not the same fact as not answerable, and this is
         * the branch that made a plain question look broken: "I could not find a
         * company called thoughworks" was the entire reply to "cmo of
         * thoughworks". Our records being silent about a company says nothing
         * about who runs it.
         */
        const identified = resolveNotes.identified;
        const label = identified?.name || companyName || selectedDomain;
        const facts: Facts = { company_not_in_our_records: true, company: label };
        if (titles.length > 0) facts.requested_titles = titles;

        /*
         * Whichever step corrected the name, the reader has to be able to see
         * that it happened: a silent correction is how a confident answer about
         * the wrong company gets believed.
         */
        const readAs = identified?.name || companyName;
        const typed = typedCompany || companyName;
        if (typed && normName(typed) !== normName(readAs)) {
          facts.interpreted_company_name_as = { typed, understood_as: readAs };
        }

        const web = await webAnswer(facts, message, titles, label, identified?.domain ?? '');
        return reply({ researched: web.researched, web_search: web.web, answer: web.answer });
      }

      resolvedOrg = resolution.org;
    }
  }

  const orgId = s(resolvedOrg?.id);
  const orgDomain = s(resolvedOrg?.primary_domain) || s(resolvedOrg?.domain);
  const orgLabel = s(resolvedOrg?.name) || companyName;

  // Echoed back so the browser can pin this company for follow-up turns.
  const ctx: ChatContext | null = orgId
    ? { org_id: orgId, name: orgLabel, domain: orgDomain }
    : null;

  // ── 6. Research, alongside everything else ───────────────────────────────
  /*
   * Started here — after disambiguation, so a "which company did you mean?"
   * turn does not pay for research it will throw away, and before every branch
   * that answers, because it is the slowest single step and needs nothing from
   * the people search.
   */
  const research = startResearch(message, companyNote(resolvedOrg));

  // ── 7. A question about the company itself ───────────────────────────────
  if (kind === 'company_info' && resolvedOrg) {
    let profile: Facts = await enrichCompanyProfile({
      apiKey,
      domain: orgDomain,
      apolloId: orgId,
      spend,
    });

    if (!profile.matched) {
      /*
       * The search row was already fetched and paid for, and it carries real
       * firmographics. Falling back to it beats telling somebody there is
       * nothing on file when there demonstrably is.
       */
      const row = companyRow(resolvedOrg);
      const kept = Object.fromEntries(Object.entries(row).filter(([, v]) => v));
      profile = { matched: true, ...kept };
    }

    const r = await research();
    return reply({
      context: ctx,
      researched: Boolean(r.text),
      web_search: r.web,
      answer: await groundedAnswer(profile, message, r.text),
    });
  }

  if (kind === 'company_info') {
    // A company question we could not pin ("tell me about the fintech market").
    // Falling through to a people search would answer a different question.
    const r = await research();
    return reply({
      context: ctx,
      researched: Boolean(r.text),
      web_search: r.web,
      answer: await groundedAnswer({}, message, r.text),
    });
  }

  // ── 8. The people filters ────────────────────────────────────────────────
  const peopleFilters: PeopleFilters = {
    titles,
    seniorities,
    max_people: kind === 'people_list' ? maxResults : 5,
  };

  // Only scope to an organisation when there really is an id. A filter of
  // [undefined] would be forwarded as-is and quietly become a GLOBAL search
  // whose results then get reported as people at this specific company.
  if (orgId) peopleFilters.organization_ids = [orgId];

  // Not an else: a resolved company and a location constraint are independent,
  // and dropping the location silently answered a different question than the
  // one asked ("the CMO of Acme in Germany").
  if (intent.company_locations.length > 0) peopleFilters.company_locations = intent.company_locations;
  if (intent.person_locations.length > 0) peopleFilters.person_locations = intent.person_locations;
  if (intent.keywords) peopleFilters.keywords = intent.keywords.slice(0, 200);

  const codes = chatCodes(intent);
  Object.assign(peopleFilters, codes.filters);

  /*
   * Everything the parser produced that could not be asked for. Carried into
   * whichever branch answers, because a constraint that was silently discarded
   * changes what the answer means and the reader cannot see it otherwise.
   */
  const parseNotes: Facts = {};
  if (seniorityDropped.length > 0) {
    parseNotes.seniority_words_apollo_does_not_have_so_they_were_ignored =
      seniorityDropped.slice(0, 6).join(', ');
  }
  if (Object.keys(codes.rejected).length > 0) {
    parseNotes.codes_that_are_not_a_valid_length_so_they_were_ignored = Object.fromEntries(
      Object.entries(codes.rejected).map(([k, v]) => [
        k,
        { codes: v.codes.slice(0, 6).join(', '), rule: v.hint },
      ]),
    );
  }
  if (Object.keys(codes.filters).length > 0) {
    parseNotes.codes_applied_by_apollo_directly = Object.fromEntries(
      Object.entries(codes.filters).map(([k, v]) => [k.replace('_codes', '').toUpperCase(), v.join(', ')]),
    );
  }

  // ── 9. Company-first scoping ─────────────────────────────────────────────
  /*
   * Skipped when the question is already about one named company: there the
   * company is not in question, and re-selecting companies could only contradict
   * the one somebody asked about.
   */
  const employer = orgId ? {} : chatEmployerFilters(intent);
  let scopeFacts: Facts = {};

  if (hasEmployerConstraints(employer)) {
    let scopeOrgs: ApolloRecord[] | null;
    let scopeRejected: Record<string, number> = {};

    try {
      const scoped = await companyScope(supabase, employer, apiKey, spend);
      scopeOrgs = scoped.orgs;
      scopeRejected = scoped.rejected;
    } catch (error) {
      /*
       * The company half could not be reached. The people search can still run,
       * but it then answers a LOOSER question than the one asked, and the answer
       * has to say so rather than presenting whoever comes back as being in that
       * industry.
       */
      console.warn(
        `finder: chat company scope failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      scopeOrgs = null;
      scopeFacts = { employer_constraints_could_not_be_applied: constraintNote(employer) };
    }

    // Taken before the branch below, because a company with no id cannot be
    // searched inside: an empty id list would be dropped and the global result
    // reported as if it had been scoped.
    const scopeIds = (scopeOrgs ?? []).map((o) => s(o.id)).filter(Boolean);

    if (scopeOrgs !== null && scopeIds.length === 0) {
      // No company matched. Answering with people anyway would be answering a
      // question nobody asked, so this is reported as the finding it is.
      const facts: Facts = { no_companies_on_file_match_these_constraints: constraintNote(employer) };

      const odd = await unknownVocabValues(supabase, employer);
      if (Object.keys(odd).length > 0) {
        facts.these_values_could_not_be_confirmed_as_ones_apollo_uses = odd;
      }
      if (Object.keys(scopeRejected).length > 0) {
        facts.companies_offered_by_the_search_but_rejected_on_checking = rejectNote(scopeRejected);
      }

      const r = await research();
      return reply({
        context: ctx,
        researched: Boolean(r.text),
        web_search: r.web,
        answer: await groundedAnswer(facts, message, r.text),
      });
    }

    if (scopeIds.length > 0) {
      peopleFilters.organization_ids = scopeIds;
      // The HQ constraint is now guaranteed by WHICH companies these are, and a
      // fuzzy location match could only take verified companies back out again.
      delete peopleFilters.company_locations;

      scopeFacts = {
        people_were_searched_only_inside_these_companies: {
          constraints_verified: constraintNote(employer),
          companies: scopeIds.length,
          examples: (scopeOrgs ?? []).slice(0, 5).map((o) => s(o.name)).filter(Boolean),
        },
      };
      if (Object.keys(scopeRejected).length > 0) {
        scopeFacts.companies_offered_by_the_search_but_rejected_on_checking = rejectNote(scopeRejected);
      }
    }
  }

  // ── 10. Search the people ────────────────────────────────────────────────
  const peopleMeta: SearchMeta = {};
  let people: Person[];

  try {
    people = (await searchPeople(peopleFilters, apiKey, {
      perPage: kind === 'people_list' ? maxResults : 10,
      strict: true,
      meta: peopleMeta,
    })) as Person[];
  } catch (error) {
    // Apollo being unreachable rules out the people half of the answer, not the
    // whole answer. Say what is missing and give what research can support.
    console.warn(
      `finder: chat people search failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    const r = await research();
    return reply({
      context: ctx,
      researched: Boolean(r.text),
      web_search: r.web,
      answer: r.text
        ? await groundedAnswer({ apollo_lookup_unavailable: true }, message, r.text)
        : 'I could not reach our contact records just now, so I do not have an answer for that yet. Try again in a moment.',
    });
  }

  /*
   * Titles are searched loosely, so a request for a CMO can come back with a
   * Marketing Manager. Verify in code that somebody actually holds the requested
   * title; if not, this is the same situation as an empty result and must go
   * down the honest path rather than presenting the nearest body as the answer.
   */
  if (people.length > 0 && titles.length > 0 && kind === 'person_at_company') {
    if (!people.some((p) => titleMatches(s(p.title), titles))) people = [];
  }

  // A person-at-company question with no extracted title has nothing to verify
  // against, so returning "the first employee listed" would be inventing an
  // answer. It becomes a list instead.
  if (kind === 'person_at_company' && titles.length === 0) kind = 'people_list';

  // ── 11. The sibling-record retry ─────────────────────────────────────────
  /**
   * True when a search that would have established an absence did not run.
   * Everything downstream that asserts "nobody" has to defer to it.
   */
  let recordsCheckIncomplete = false;

  if (people.length === 0 && titles.length > 0 && orgDomain && peopleFilters.organization_ids) {
    /*
     * One real company often has SEVERAL organisation records — regional
     * entities, a holding company, an acquired brand — and `organization_ids`
     * scopes to exactly one. An executive filed under a sibling then looks like
     * "nobody holds this title" when they are simply on another row. Retrying
     * scoped by the shared employer DOMAIN fixes that: the domain is enforced
     * strictly in code, so this widens which company records are covered without
     * loosening which company is being asked about. Free, and it can only add.
     */
    const retry: PeopleFilters = { ...peopleFilters };
    delete retry.organization_ids;
    retry.company_domains = [orgDomain];

    try {
      people = (await searchPeople(retry, apiKey, {
        perPage: kind === 'people_list' ? maxResults : 10,
        strict: true,
        meta: peopleMeta,
      })) as Person[];
    } catch (error) {
      /*
       * NOT `people = []`. This retry is not an optional extra: the org-id
       * search coming back empty does not establish that nobody holds the title,
       * only that nobody on THAT record does. Swallowing the failure sent the
       * answer down the "no one holds the requested title" path, whose whole
       * premise is that the absence was checked, and the check is exactly what
       * just failed.
       */
      console.warn(
        `finder: chat domain-scoped retry failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      people = [];
      recordsCheckIncomplete = true;
    }

    // The same loose-title check has to apply to the retry, or this becomes a
    // back door that returns a Marketing Manager as the CMO.
    if (people.length > 0 && kind === 'person_at_company') {
      if (!people.some((p) => titleMatches(s(p.title), titles))) people = [];
    }
  }

  // ── 12. List-level title verification ────────────────────────────────────
  const verified = verifyChatPeople(people, titles);
  people = verified.kept;
  const titleDropped = verified.dropped;

  // ── 13. The same-function consolation list ───────────────────────────────
  let noTitleMatch = false;
  const wantFunctions = titles.length > 0 ? requestedFunctions(titles) : new Set<string>();
  const functionName = functionLabel(wantFunctions);

  /*
   * Not on an incomplete check. This branch reads an empty list as "nobody holds
   * this title here", and everything downstream inherits that. When the search
   * that would have established the "nobody" is the one that failed, the list
   * has to stay empty so the records-gap branch answers instead. Gated HERE
   * rather than further down, because by then the list is already the
   * same-function one, and near-misses shown without that framing read as the
   * answer to the question asked.
   */
  if (people.length === 0 && !recordsCheckIncomplete && orgId && (titles.length > 0 || seniorities.length > 0)) {
    noTitleMatch = true;
    people = await sameFunctionPeople(orgId, wantFunctions, apiKey);
  }

  // ── 14. Who publicly holds the role ──────────────────────────────────────
  /*
   * Both records-gap branches want the same web lookup, so it runs at most once
   * per question and only on paths that actually reach a gap — never on a
   * question our records answered.
   */
  let roleCached: { value: RoleHolder | null } | null = null;
  const publicRole = async (): Promise<RoleHolder | null> => {
    if (!roleCached) {
      roleCached = { value: null };
      if (titles.length > 0 && orgLabel) {
        roleCached.value = await roleLookup(titles, orgLabel, orgDomain);
      }
    }
    return roleCached.value;
  };

  /**
   * The two things that were wrong with naming somebody and stopping.
   *
   * **First**, the answer used to assert that our records do not have them: a
   * negative nobody had checked, and usually false, because the only search that
   * ran was filtered by TITLE — so a published CMO filed as "SVP Marketing" was
   * reported as absent. That is now looked up by name, for free, and the claim
   * either way is code-established rather than assumed.
   *
   * **Second**, there was no way to act on the name. A match can resolve
   * somebody by name plus employer domain even when the title-scoped search
   * never surfaced them, so a button is offered whenever there is a domain to
   * match against. Either way it spends nothing until it is clicked.
   */
  const roleHolderExtras = async (
    role: RoleHolder,
  ): Promise<{ facts: Facts; chip: EnrichChip | null }> => {
    const who = role.name;
    if (!who || !orgDomain) return { facts: {}, chip: null };

    const checked: { ok?: boolean } = {};
    const onFile = await personOnFile(who, orgDomain, apiKey, checked);

    if (onFile) {
      return {
        facts: { public_role_holder_is_on_file: answerPerson(onFile, false) },
        chip: {
          type: 'person',
          name: s(onFile.full_name) || who,
          title: s(onFile.title) || role.title,
          domain: orgDomain,
          apollo_id: s(onFile.id),
        },
      };
    }

    const chip: EnrichChip = { type: 'person', name: who, title: role.title, domain: orgDomain, apollo_id: '' };

    if (!checked.ok) {
      /*
       * Neither key, deliberately. The answer prompt's own rule for that case is
       * already exactly right: if neither is present, nobody checked, so say
       * nothing at all about whether we hold them. Sending the "not in our
       * records" key here would have the model state an absence that no request
       * ever established.
       */
      console.info('finder: chat on-file check did not complete, claiming nothing');
      return { facts: {}, chip };
    }

    return { facts: { public_role_holder_not_in_our_records: true }, chip };
  };

  // ── The records-gap answer ───────────────────────────────────────────────
  if (people.length === 0) {
    /*
     * "Our records have nobody matching that" is a claim, and this is the one
     * branch that cannot tell on its own whether it earned the right to make it:
     * an empty list arrives here identically whether Apollo answered with
     * nothing or the widening retry failed mid-way. The researched role holder
     * and everything else still travel with the answer; only the sentence
     * asserting an absence is withdrawn.
     */
    const facts: Facts = recordsCheckIncomplete
      ? { apollo_lookup_unavailable: true }
      : { apollo_found_no_matching_people: true };

    if (titles.length > 0) facts.requested_titles = titles;
    if (resolvedOrg) facts.company = orgLabel;
    Object.assign(facts, scopeFacts, parseNotes);
    if (titleDropped) facts.people_offered_but_rejected_on_checking_their_titles = titleDropped;

    /*
     * We did not merely fail to find the exact title: we then looked for anyone
     * in that whole function and found nobody either. Worth saying, because it
     * is the difference between "not under that title" and "not in our records
     * at all", and it is why no alternative contacts are being offered.
     */
    if (noTitleMatch && functionName) facts.no_one_in_this_function_on_file = functionName;

    const role = await publicRole();
    let chip: EnrichChip | null = null;
    if (role) {
      facts.public_role_holder = role;
      const extras = await roleHolderExtras(role);
      Object.assign(facts, extras.facts);
      chip = extras.chip;
    }

    const r = await research();
    return reply({
      context: ctx,
      researched: Boolean(r.text),
      web_search: r.web,
      answer: await groundedAnswer(facts, message, r.text),
      ...(chip ? { enrich: [chip] } : {}),
    });
  }

  // ── One person ───────────────────────────────────────────────────────────
  if (kind === 'person_at_company' && !noTitleMatch) {
    // Prefer somebody whose real title actually matches what was asked for,
    // rather than whatever the search happened to rank first.
    let top = people.find((p) => titleMatches(s(p.title), titles)) ?? people[0];

    /*
     * A name is the minimum this answer needs to be useful, and the free search
     * can withhold a surname. This is NOT the paid enrichment below: it spends a
     * credit only on the case where the name actually came back masked, and
     * exists specifically so naming somebody correctly does not require paying
     * for their email and phone too.
     */
    top = (await revealNames(supabase, [top], apiKey, spend))[0];

    // If the reveal could not un-mask them, the model must still never be handed
    // "Vivek Sh***a" to copy into prose.
    let facts: Facts = { person: displayPerson(top), asked_for_titles: titles };
    let fullProfile = '';
    let chip: EnrichChip | null = null;

    if (wantsContact) {
      /*
       * The question asked for contact details by name, so there is no reason to
       * make somebody click for them: spend the one-credit enrichment now and
       * show everything it returns. Allowlisted, not denylisted, so a new field
       * on the profile shape cannot leak into the model's own prose by default.
       */
      const enriched = await enrichPerson({
        supabase,
        apiKey,
        name: s(top.full_name),
        domain: s(top.organization_domain) || orgDomain,
        apolloId: s(top.id),
        spend,
      });

      if (enriched.matched) {
        facts = {
          person: answerPerson(enriched as unknown as Facts, true),
          asked_for_titles: titles,
          full_apollo_profile_follows: true,
        };
        fullProfile = renderFullProfile(enriched as never);
      }
    }

    // Merged after the reassignment above, so a question that constrained the
    // employer still says which constraints were checked.
    Object.assign(facts, scopeFacts);

    if (!fullProfile && s(top.id)) {
      /*
       * Nobody asked for contact details, so the credit for the full enrichment
       * is not spent up front: a button is offered instead. This metadata is
       * wiring for the interface, not a fact for the model, so it travels
       * outside the facts and must never reach the answer prompt.
       */
      chip = enrichChip(top, orgDomain);
    }

    const r = await research();
    let answer = await groundedAnswer(facts, message, r.text);
    if (fullProfile) answer = `${answer.trimEnd()}\n\n${fullProfile}`;

    return reply({
      context: ctx,
      researched: Boolean(r.text),
      web_search: r.web,
      answer,
      ...(chip ? { enrich: [chip] } : {}),
    });
  }

  // ── A list ───────────────────────────────────────────────────────────────
  /*
   * Revealed once, then reused by whichever facts shape this answer takes.
   *
   * ...but NOT on the consolation path. When the question was "who is the CEO"
   * and nobody on file holds that title, this list is the nearest senior
   * contacts offered INSTEAD of an answer: people nobody asked about. Paying to
   * un-mask their surnames spends real money on a substitute for the answer,
   * which is how one question cost four credits for a reply that named two
   * people the asker had not asked for and enriched nobody. The free rows are
   * shown as they came, and anyone worth the spend is one click away. A list
   * somebody DID ask for still reveals: there the names are the answer.
   */
  const consolation = noTitleMatch && titles.length > 0;
  const shown = consolation
    ? people
    : await revealNames(supabase, people.slice(0, maxResults), apiKey, spend);

  let facts: Facts = { people: displayPeople(shown) };
  Object.assign(facts, scopeFacts, parseNotes);
  if (titleDropped) facts.people_offered_but_rejected_on_checking_their_titles = titleDropped;

  if (intent.person_locations.length > 0) {
    /*
     * Where a PERSON lives is filtered against fields this plan does not return
     * to us — a free row has no city and no country — so this one cannot be
     * checked the way the others were. Saying so is the only honest option: the
     * alternative is an answer that sounds equally sure about the part we
     * verified and the part we could not.
     */
    facts.person_location_asked_for_but_not_independently_verified = intent.person_locations
      .join(', ')
      .slice(0, 120);
  }

  if (wantsContact) {
    // The question asked for contact details and this is a list, so nothing was
    // enriched: doing it for everyone would spend a credit per person on what
    // might have been idle curiosity. The buttons do it one at a time.
    facts.contact_details_are_not_included_and_need_enriching = true;
  }

  const total = peopleMeta.total_entries ?? null;
  // Only worth telling the model about when it changes what "the list" means: a
  // total that matches what came back is not a partial sample.
  if (total !== null && total > shown.length) {
    facts.returned_count = shown.length;
    if (titles.length > 0 || titleDropped || hasEmployerConstraints(employer)) {
      /*
       * The vendor's total describes the search we SENT, and that search asked
       * loosely on purpose: similar titles included, an industry treated as a
       * keyword over company names, then narrowed in code afterwards. It is the
       * one number in the answer a reader cannot check, and it used to be the
       * headline: 295 "healthcare CMOs" who were really 295 people at companies
       * with the word "healthcare" in their name.
       */
      facts.apollo_loose_match_total_is_only_an_upper_bound = total;
    } else {
      facts.total_matching_count = total;
    }
  }

  let leadChip: EnrichChip | null = null;

  if (consolation) {
    facts = {
      no_one_holds_the_requested_title: true,
      requested_titles: titles,
      company: orgLabel,
      // Compact briefs, not raw rows: each is a name AND a title, so an answer
      // cannot list six people without saying what any of them do.
      closest_people_we_hold: shown.map(contactBrief),
    };

    // Named, so the answer can say WHY these particular people are the ones
    // being offered rather than leaving the reader to guess the connection.
    if (functionName) facts.these_people_all_work_in = functionName;

    // Their surnames were not bought, so some may arrive shortened. Flagged so
    // the answer says why rather than printing a half-name.
    if (shown.some((p) => nameIncomplete(p))) facts.some_surnames_withheld_until_enriched = true;

    const role = await publicRole();
    if (role) {
      facts.public_role_holder = role;
      const extras = await roleHolderExtras(role);
      Object.assign(facts, extras.facts);
      leadChip = extras.chip;
    }
  }

  /*
   * Everyone this answer names who can be revealed gets a button, not only the
   * person the question was about. A list answer offered none at all, so the
   * only way to act on a name it had just produced was to retype that name as a
   * whole new question. On the consolation path this is also what makes the
   * withheld-surname note actionable.
   */
  let chips = shown.map((p) => enrichChip(p, orgDomain)).filter((c): c is EnrichChip => c !== null);

  if (leadChip) {
    // The publicly named role holder leads: they are the answer to what was
    // asked, and the on-file people are the alternatives to them.
    chips = [leadChip, ...chips.filter((c) => !(leadChip.apollo_id && c.apollo_id === leadChip.apollo_id))];
  }
  chips = chips.slice(0, CHIP_CAP);

  const r = await research();
  return reply({
    context: ctx,
    researched: Boolean(r.text),
    web_search: r.web,
    answer: await groundedAnswer(facts, message, r.text),
    ...(chips.length > 0 ? { enrich: chips } : {}),
  });

  /**
   * A question our own records cannot settle, answered from the public web
   * rather than dead-ended.
   *
   * The two slow calls need nothing from each other, so they overlap. A hung
   * role lookup degrades the answer rather than holding the request open.
   */
  async function webAnswer(
    facts: Facts,
    question: string,
    wantedTitles: readonly string[],
    label: string,
    domain: string,
  ): Promise<{ answer: string; researched: boolean; web: boolean }> {
    const rolePromise =
      wantedTitles.length > 0 && label
        ? roleLookup(wantedTitles, label, domain).catch(() => null)
        : Promise.resolve(null);

    const researched = await runResearch(question, companyNote({ name: label, primary_domain: domain }));
    const role = await rolePromise;

    const all: Facts = { ...facts };
    if (role) all.public_role_holder = role;

    return {
      answer: await groundedAnswer(all, question, researched.text),
      researched: Boolean(researched.text),
      web: researched.sources.length > 0,
    };
  }
}

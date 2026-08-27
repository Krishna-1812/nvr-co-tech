import type { FillOutcome } from './AskBar';
import type { ChatContext, Turn } from './Chat';
import type { Entity, PanelValues } from './filters';

/**
 * What the workspace knows.
 *
 * ── `entity` and `shownEntity` were one variable ───────────────────────────
 *
 * Separating them fixed four bugs at once. Flipping the People/Companies toggle
 * relabelled a grid of people as companies without refetching, so the next
 * re-render drew them through the company card (every field blank, every name
 * "Unknown"), an export built company columns out of person rows, and Load more
 * appended companies to the bottom of a people list.
 *
 * The rule: **anything describing the rows reads `shownEntity`; only the search
 * itself reads `entity`.**
 *
 * ── `selected` is keyed by id, not by index ────────────────────────────────
 *
 * So a tick survives Load more, survives a re-render after a bulk enrich, and
 * survives reopening a saved search. Keyed by position, every one of those
 * silently moved the tick to a different person.
 */

export type Row = Record<string, unknown>;

export type Choice = {
  name: string | null;
  domain: string;
  id: string | null;
  logo: string | null;
  hq: string;
};

export type SearchOutcome = {
  results?: Row[];
  has_more?: boolean;
  total?: number | null;
  page?: number;
  search_failed?: boolean;
  error?: string;
  needs_company_choice?: boolean;
  choices?: Choice[];
  resolved_company?: (string | null)[];
  companies_described?: { orgs: number; cached: number; fetched: number };
  company_unconfirmed?: number;
  company_detail?: boolean;
  industry_forced_company_detail?: boolean;
  rejected?: Record<string, number>;
  rejected_total?: number;
  rejected_labels?: Record<string, string>;
  invalid_codes?: Record<string, { codes: string[]; hint: string }>;
  funding_value_clamped?: boolean;
  credits?: number;
};

export type View = 'cards' | 'table';

/** What one bulk reveal actually did, kept apart from what was asked of it. */
export type RevealOutcome = {
  fetched: number;
  cached: number;
  capped: boolean;
  unreachable: number;
  error?: string;
};

/**
 * The open profile panel.
 *
 * `subject` is what was asked for and stays put while the answer is in flight,
 * so the panel can name the person it is loading rather than opening blank. Once
 * `data` arrives it is the only thing rendered — including a `matched: false`,
 * which is a real answer and not an error.
 */
export type ProfileSubject = { name: string; domain: string; apolloId: string };

export type ProfileState = {
  kind: 'person' | 'company';
  subject: ProfileSubject;
  loading: boolean;
  data: Record<string, unknown> | null;
  /** A failure to ASK. Never the same as an answer that found nobody. */
  error: string | null;
  /** What THIS lookup cost. Zero is a real answer: a cache hit is free. */
  credits: number | null;
};

export type State = {
  /** What the PANEL is set to, which is what the next search looks for. */
  entity: Entity;
  /** What the rows currently on screen actually ARE. Null before any search. */
  shownEntity: Entity | null;
  values: PanelValues;
  page: number;
  results: Row[];
  selected: Record<string, true>;
  total: number | null;
  hasMore: boolean;
  loading: boolean;
  /** A search that FAILED. Deliberately not the same field as an empty result. */
  failure: string | null;
  /** A refusal that is not a failure: no such company, not configured, and so on. */
  notice: string | null;
  choices: Choice[] | null;
  resolved: string[] | null;
  rejected: Record<string, number> | null;
  rejectedLabels: Record<string, string>;
  rejectedTotal: number;
  unconfirmed: number;
  described: { orgs: number; cached: number; fetched: number } | null;
  detailOnRows: boolean | null;
  detailForced: boolean;
  invalidCodes: Record<string, { codes: string[]; hint: string }> | null;
  fundingClamped: boolean;
  view: View;
  /** Apollo's own free count for the filters as they stand, and whether it is a bound. */
  count: { value: number | null; approx: boolean; reason?: string } | null;
  counting: boolean;
  /**
   * The history entry the rows on screen belong to.
   *
   * A "Load more" is the same search getting longer, not a new one, so this id
   * goes back with the save and the entry grows in place. Without it, paging
   * three deep wrote three entries holding 24, 48 and 72 rows and evicted real
   * history against the 60-entry cap.
   */
  historyId: number | null;
  /** Set when a paged search outgrew what one entry can hold. */
  historyTruncated: { kept: number; of: number } | null;
  /** How many rows are on the working list, so the button can say. */
  listCount: number;
  /**
   * The conversation, resent in full on every turn.
   *
   * Kept here rather than on the server, which is what makes "the second one"
   * resolve against a list from a prior turn with no session state anywhere.
   */
  chat: Turn[];
  chatBusy: boolean;
  /** The company follow-ups inherit, until a turn says to forget it. */
  chatContext: ChatContext | null;
  /** Below the widest breakpoint the conversation is a sheet rather than a rail. */
  chatOpen: boolean;
  /** A sentence being read into filters. Costs nothing and searches nothing. */
  filling: boolean;
  /** What the last sentence became, until it is dismissed. */
  fill: FillOutcome | null;
  /** The open profile panel, or nothing. */
  profile: ProfileState | null;
  /** A bulk reveal in flight. Separate from `loading`, which is the search. */
  revealing: boolean;
  /** What the last reveal did, until the next one replaces it. */
  reveal: RevealOutcome | null;
};

export const INITIAL: State = {
  entity: 'people',
  shownEntity: null,
  values: { include_similar_titles: true, company_detail: true },
  page: 1,
  results: [],
  selected: {},
  total: null,
  hasMore: false,
  loading: false,
  failure: null,
  notice: null,
  choices: null,
  resolved: null,
  rejected: null,
  rejectedLabels: {},
  rejectedTotal: 0,
  unconfirmed: 0,
  described: null,
  detailOnRows: null,
  detailForced: false,
  invalidCodes: null,
  fundingClamped: false,
  view: 'cards',
  count: null,
  counting: false,
  historyId: null,
  historyTruncated: null,
  listCount: 0,
  chat: [],
  chatBusy: false,
  chatContext: null,
  chatOpen: false,
  filling: false,
  fill: null,
  profile: null,
  revealing: false,
  reveal: null,
};

export type Action =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'entity'; entity: Entity }
  | { type: 'clear' }
  | { type: 'view'; view: View }
  | { type: 'searching'; reset: boolean }
  | { type: 'result'; out: SearchOutcome; reset: boolean; entity: Entity }
  | { type: 'toggle'; id: string }
  | { type: 'selectAll'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'counting' }
  | { type: 'count'; count: State['count'] }
  | { type: 'ask'; question: string }
  | { type: 'answered'; turn: Turn; context?: ChatContext | null; clearContext?: boolean }
  | { type: 'unpin' }
  | { type: 'chatOpen'; open: boolean }
  | { type: 'filling' }
  | { type: 'filled'; entity: Entity; values: PanelValues; outcome: FillOutcome }
  | { type: 'fillFailed'; outcome: FillOutcome }
  | { type: 'dismissFill' }
  | { type: 'saved'; id: number | null; truncated: { kept: number; of: number } | null }
  | { type: 'listCount'; count: number }
  | {
      type: 'reopen';
      entity: Entity;
      values: PanelValues;
      rows: Row[];
      total: number | null;
      id: number;
    }
  | { type: 'openProfile'; kind: 'person' | 'company'; subject: ProfileState['subject'] }
  | { type: 'profile'; data: Record<string, unknown> | null; error?: string; credits?: number }
  | { type: 'closeProfile' }
  | { type: 'revealing' }
  | {
      type: 'revealed';
      profiles: Record<string, Record<string, unknown>>;
      outcome: RevealOutcome;
      credits: number;
    };

export function rowId(row: Row): string {
  return String(row.id ?? '');
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return {
        ...state,
        values: { ...state.values, [action.key]: action.value },
        // The count belongs to one filter set. Clearing it on every change is
        // what stops a stale figure sitting under filters that have since moved.
        count: null,
      };

    case 'entity':
      /*
       * Deliberately leaves `results` and `shownEntity` alone. Switching tabs
       * changes what the next search looks for; it does not retrospectively
       * turn the people on screen into companies.
       */
      return { ...state, entity: action.entity, count: null };

    case 'clear':
      return {
        ...state,
        values: { include_similar_titles: true, company_detail: state.values.company_detail },
        count: null,
      };

    case 'view':
      return { ...state, view: action.view };

    case 'searching':
      return {
        ...state,
        loading: true,
        failure: null,
        notice: null,
        choices: null,
        reveal: null,
        // A fresh search owns no history entry yet, so the next save writes a
        // new one instead of overwriting the last search's rows with these.
        ...(action.reset ? { page: 1, historyId: null, historyTruncated: null } : {}),
      };

    case 'result': {
      const out = action.out;

      /*
       * A search that failed is not a search that found nothing. Nothing below
       * this guard runs: there is no page to advance, no count to write and no
       * rows to replace for a search that did not happen — and on a reset, the
       * rows already on screen are left exactly where they were rather than
       * being wiped to draw an empty state over the top.
       */
      if (out.search_failed) {
        return { ...state, loading: false, failure: out.error ?? 'Apollo did not answer.' };
      }

      if (out.needs_company_choice) {
        return { ...state, loading: false, choices: out.choices ?? [] };
      }

      if (out.error) {
        return { ...state, loading: false, notice: out.error };
      }

      const incoming = out.results ?? [];
      const results = action.reset ? incoming : [...state.results, ...incoming];

      return {
        ...state,
        loading: false,
        shownEntity: action.entity,
        results,
        // Advances only when a page actually came back, so Load more fetches the
        // next page rather than re-fetching page 1 and appending duplicates.
        page: out.page ?? state.page,
        total: out.total ?? null,
        hasMore: Boolean(out.has_more),
        selected: action.reset ? {} : state.selected,
        resolved: (out.resolved_company ?? null) as string[] | null,
        rejected: out.rejected ?? null,
        rejectedLabels: out.rejected_labels ?? {},
        rejectedTotal: out.rejected_total ?? 0,
        unconfirmed: out.company_unconfirmed ?? 0,
        described: out.companies_described ?? null,
        detailOnRows: out.company_detail ?? null,
        detailForced: Boolean(out.industry_forced_company_detail),
        invalidCodes: out.invalid_codes ?? null,
        fundingClamped: Boolean(out.funding_value_clamped),
        // Turning the lookup back on is a fact about what ran, so the control
        // catches up with it rather than continuing to claim it was off.
        values: out.industry_forced_company_detail
          ? { ...state.values, company_detail: true }
          : state.values,
      };
    }

    case 'toggle': {
      const selected = { ...state.selected };
      if (selected[action.id]) delete selected[action.id];
      else selected[action.id] = true;
      return { ...state, selected };
    }

    case 'selectAll': {
      const all = action.ids.every((id) => state.selected[id]);
      if (all) return { ...state, selected: {} };
      const selected = { ...state.selected };
      for (const id of action.ids) selected[id] = true;
      return { ...state, selected };
    }

    case 'clearSelection':
      return { ...state, selected: {} };

    case 'counting':
      return { ...state, counting: true };

    case 'count':
      return { ...state, counting: false, count: action.count };

    case 'ask':
      return {
        ...state,
        chatBusy: true,
        chat: [
          ...state.chat,
          { role: 'user', content: action.question },
          // A placeholder rather than a spinner beside the box: an answer can
          // take most of a minute, and the reader should be able to see that
          // their question was taken while it does.
          { role: 'assistant', content: '', pending: true },
        ],
      };

    case 'answered': {
      const chat = [...state.chat];
      // Replaces the placeholder in place, so nothing shifts under the reader.
      const last = chat.length - 1;
      if (last >= 0 && chat[last].pending) chat[last] = action.turn;
      else chat.push(action.turn);

      return {
        ...state,
        chatBusy: false,
        chat,
        /*
         * A reply carrying a company supersedes the pin; a reply saying to clear
         * it drops the pin; a reply saying neither leaves it exactly where it
         * was, which is what makes "and their VP of Sales?" work.
         */
        chatContext: action.context ?? (action.clearContext ? null : state.chatContext),
      };
    }

    case 'unpin':
      return { ...state, chatContext: null };

    case 'chatOpen':
      return { ...state, chatOpen: action.open };

    case 'filling':
      return { ...state, filling: true, fill: null };

    case 'filled':
      /*
       * Replaces the filters rather than merging into them. A sentence is a
       * whole question, and merging it over what was already set produces a
       * search that is neither the one on screen nor the one just typed — with
       * nothing to say which parts came from where.
       */
      return {
        ...state,
        filling: false,
        fill: action.outcome,
        entity: action.entity,
        values: { include_similar_titles: true, company_detail: true, ...action.values },
        count: null,
      };

    case 'fillFailed':
      /*
       * Leaves the panel exactly as it was. A sentence that could not be read is
       * no reason to clear filters somebody set by hand, and clearing them is
       * the one outcome that turns a failed convenience into lost work.
       */
      return { ...state, filling: false, fill: action.outcome };

    case 'dismissFill':
      return { ...state, filling: false, fill: null };

    case 'saved':
      return { ...state, historyId: action.id, historyTruncated: action.truncated };

    case 'listCount':
      return { ...state, listCount: action.count };

    case 'reopen':
      /*
       * A reopened entry is a snapshot, not a live search. `hasMore` is false
       * and the page is 1 on purpose: "Load more" against a stored result set
       * would fetch page 2 of a search nobody has re-run and staple it to rows
       * that may be months old.
       */
      return {
        ...state,
        loading: false,
        failure: null,
        notice: null,
        choices: null,
        entity: action.entity,
        shownEntity: action.entity,
        values: action.values,
        results: action.rows,
        selected: {},
        total: action.total,
        page: 1,
        hasMore: false,
        historyId: action.id,
        historyTruncated: null,
        rejected: null,
        rejectedLabels: {},
        rejectedTotal: 0,
        unconfirmed: 0,
        described: null,
        reveal: null,
        count: null,
      };

    case 'openProfile':
      return {
        ...state,
        profile: {
          kind: action.kind,
          subject: action.subject,
          loading: true,
          data: null,
          error: null,
          credits: null,
        },
      };

    case 'profile': {
      // Arriving after the panel was closed is not a reason to reopen it.
      if (!state.profile) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          loading: false,
          data: action.data,
          error: action.error ?? null,
          credits: action.credits ?? null,
        },
      };
    }

    case 'closeProfile':
      return { ...state, profile: null };

    case 'revealing':
      return { ...state, revealing: true, reveal: null };

    case 'revealed': {
      /*
       * Merged into the rows already on screen rather than replacing them.
       * The enriched record wins every field it has — the real surname, the
       * email, the phone — and the search row keeps anything it carried that
       * the reveal does not, such as the flag saying this team already owned
       * the contact.
       */
      const results = state.results.map((row) => {
        const fresh = action.profiles[rowId(row)];
        return fresh ? { ...row, ...fresh } : row;
      });

      return {
        ...state,
        revealing: false,
        results,
        reveal: action.outcome,
      };
    }

    default:
      return state;
  }
}

/**
 * Which filter a rejection reason blames.
 *
 * "hq" is the one reason two different keys can produce depending on the tab, so
 * it is resolved separately: a fixed entry was wrong on one tab no matter which
 * key it named.
 */
const REJECT_FILTER: Readonly<Record<string, readonly string[]>> = {
  industry: ['industries'],
  employees: ['employee_range'],
  revenue: ['revenue_min', 'revenue_max'],
  technology: ['technologies'],
  title: ['titles'],
  company: ['company_domains'],
  domain: ['domains'],
  excluded_keyword: ['exclude_keywords'],
};

export function rejectFilterKeys(reason: string, shown: Entity | null): readonly string[] {
  if (reason === 'hq') return shown === 'companies' ? ['locations'] : ['company_locations'];
  return REJECT_FILTER[reason] ?? [];
}

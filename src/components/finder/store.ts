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
  /** Credits this browser has watched being spent, since the page loaded. */
  spent: number;
  view: View;
  /** Apollo's own free count for the filters as they stand, and whether it is a bound. */
  count: { value: number | null; approx: boolean; reason?: string } | null;
  counting: boolean;
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
  spent: 0,
  view: 'cards',
  count: null,
  counting: false,
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
  | { type: 'count'; count: State['count'] };

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
        ...(action.reset ? { page: 1 } : {}),
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
        spent: state.spent + (out.credits ?? 0),
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

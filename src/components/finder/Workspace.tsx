'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Building2,
  Clock,
  Download,
  LayoutGrid,
  ListPlus,
  MessagesSquare,
  Rows3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer } from '@/components/ui/Drawer';
import { AskBar } from './AskBar';
import { InvalidCodes, QueryBar, RejectionBanner } from './Banners';
import { Chat, type ChatContext, type EnrichChip, type Turn } from './Chat';
import { CreditLine, HistoryDrawer, ListDrawer } from './Drawers';
import { FilterPanel } from './FilterPanel';
import { ProfilePanel } from './Profile';
import { Results } from './Results';
import { panelFromFilters, toFilters, type Entity, type PanelValues } from './filters';
import {
  INITIAL,
  reducer,
  rowId,
  type Choice,
  type ProfileSubject,
  type RevealOutcome,
  type Row,
  type SearchOutcome,
} from './store';

/**
 * Contact Finder's one screen.
 *
 * A filter rail on the left, results in the middle, and — from the stage that
 * adds it — a chat panel on the right. They are one screen rather than three
 * because they are ways of asking the same question, and because the answer to a
 * chat question is very often "now refine that in the filters".
 *
 * ── What this component is careful about ───────────────────────────────────
 *
 * Two things, both of which are about not overstating. A search that FAILED is
 * kept apart from a search that found nothing, all the way into what is drawn:
 * a failure leaves the rows already on screen alone and says Apollo did not
 * answer, rather than wiping them to draw "no matches" over the top. And every
 * row Apollo returned that does not actually satisfy the filters is removed and
 * *counted*, so no page ever silently shrinks.
 */

const COUNT_DEBOUNCE_MS = 420;

export function Workspace() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  /**
   * Whether the filter fields are open on a narrow screen.
   *
   * Plain component state rather than part of the store: it describes the shape
   * of the screen, not the search, and nothing in the reducer needs to read it.
   */
  const [railOpen, setRailOpen] = useState(false);

  /**
   * Which section of the rail is showing: the fields that shape a search, or
   * history / the working list / this month's spend, which are about every
   * search rather than the one on screen. Plain component state, same reason
   * as `railOpen` — it describes the rail, not the search.
   */
  const [panelTab, setPanelTab] = useState<'filters' | 'activity'>('filters');

  /*
   * A sequence number, so a slow answer to an earlier keystroke cannot land on
   * top of a fast answer to a later one.
   */
  const countSeq = useRef(0);

  const set = useCallback((key: string, value: unknown) => {
    dispatch({ type: 'set', key, value });
  }, []);

  const search = useCallback(
    async (reset: boolean, overrides?: { values?: Record<string, unknown>; entity?: Entity }) => {
      const entity = overrides?.entity ?? state.entity;
      const values = overrides?.values ?? state.values;
      const page = reset ? 1 : state.page + 1;

      dispatch({ type: 'searching', reset });

      let out: SearchOutcome;
      try {
        const response = await fetch('/api/finder/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entity, page, filters: toFilters(entity, values) }),
        });
        out = (await response.json()) as SearchOutcome;
        // A refusal from the gate arrives as {error} with a non-2xx status, and
        // is a fact about permission rather than about the world.
        if (!response.ok && !out.search_failed) out = { ...out, error: out.error };
      } catch {
        out = {
          search_failed: true,
          error: 'The search could not be sent, so nothing was found and nothing was ruled out.',
        };
      }

      dispatch({ type: 'result', out, reset, entity });

      /*
       * Saved after the rows are drawn, never before, and never awaited by
       * anything the reader is waiting on. History is a convenience; a database
       * that is slow or unhappy must not hold up a result that has already
       * arrived, and must never turn one into an error.
       */
      const fresh = out.results ?? [];
      if (out.search_failed || out.needs_company_choice || fresh.length === 0) return;

      const rows = reset ? fresh : [...state.results, ...fresh];
      try {
        const saved = await fetch('/api/finder/history', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            entity,
            rows,
            total: out.total ?? null,
            // The panel's own state travels alongside the Apollo filters so a
            // reopened entry puts the controls back where they were. The export
            // sheet knows to ignore it.
            filters: { ...toFilters(entity, values), panel: values },
            replace_id: reset ? null : state.historyId,
          }),
        }).then((r) => r.json() as Promise<{ id?: number; truncated?: boolean; kept?: number; of?: number }>);

        dispatch({
          type: 'saved',
          id: saved.id ?? null,
          truncated:
            saved.truncated && saved.kept && saved.of ? { kept: saved.kept, of: saved.of } : null,
        });
      } catch {
        // Nothing to tell anybody: the rows are on screen either way, and the
        // only loss is being able to come back to them without searching again.
      }
    },
    [state.entity, state.values, state.page, state.results, state.historyId],
  );

  /*
   * The live count. People only, debounced, and never run on an empty filter
   * set: counting nothing means asking Apollo how many people it has, which is
   * a number in the hundreds of millions that describes the database rather
   * than the search.
   */
  useEffect(() => {
    if (state.entity !== 'people') return;

    const filters = toFilters('people', state.values);
    const meaningful = Object.keys(filters).filter(
      (k) => k !== 'include_similar_titles' && k !== 'company_detail',
    );
    if (meaningful.length === 0) return;

    const seq = (countSeq.current += 1);
    dispatch({ type: 'counting' });

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/finder/count', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entity: 'people', filters }),
        });
        const data = (await response.json()) as {
          count?: number | null;
          approx?: boolean;
          reason?: string;
        };
        if (seq !== countSeq.current) return;
        dispatch({
          type: 'count',
          count: { value: data.count ?? null, approx: Boolean(data.approx), reason: data.reason },
        });
      } catch {
        if (seq === countSeq.current) dispatch({ type: 'count', count: null });
      }
    }, COUNT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.entity, state.values]);

  /**
   * Drop the filter a rejection reason blames, and run the search again.
   *
   * Both halves of a band go together: clearing only the floor and leaving the
   * ceiling would re-run a search that still excludes for the same reason.
   */
  const relax = (keys: readonly string[]) => {
    const values = { ...state.values };
    for (const key of keys) delete values[key];
    for (const key of keys) dispatch({ type: 'set', key, value: undefined });
    /*
     * Searches the entity the BANNER is about, not whichever tab happens to be
     * open. Acting has to mean "fix and re-run the search that produced this",
     * not "clear a filter on the open panel and search that instead", which
     * once cleared a People filter in the background while launching an
     * unrelated, credit-costing Companies search.
     */
    void search(true, { values, entity: state.shownEntity ?? state.entity });
  };

  /**
   * Open the full record for one subject.
   *
   * Takes a subject rather than a row, because two surfaces reach it: a card or
   * a table row in the grid, and a button under a chat answer. The button has no
   * row behind it — a publicly named person may have no record here at all —
   * and it is exactly the case where an id, a name and a domain are all there is
   * to go on.
   */
  const reveal = useCallback(
    async (kind: 'person' | 'company', subject: ProfileSubject) => {
      dispatch({ type: 'openProfile', kind, subject });

      try {
        const response = await fetch('/api/finder/enrich', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: kind,
            name: subject.name,
            domain: subject.domain,
            apollo_id: subject.apolloId,
          }),
        });
        const data = (await response.json()) as {
          profile?: Record<string, unknown>;
          credits?: number;
          error?: string;
        };

        if (!response.ok) {
          dispatch({ type: 'profile', data: null, error: data.error ?? 'That could not be looked up.' });
          return;
        }
        dispatch({ type: 'profile', data: data.profile ?? null, credits: data.credits ?? 0 });
      } catch {
        dispatch({
          type: 'profile',
          data: null,
          error: 'The request could not be sent, so nothing was looked up and nothing was spent.',
        });
      }
    },
    [],
  );

  /**
   * One grid row's full record.
   *
   * The kind comes from `shownEntity` — what the rows on screen actually are —
   * rather than from the panel, which may have been flipped to the other tab
   * since the search ran. Getting that wrong sends a person's Apollo id to the
   * company endpoint, which matches nothing and bills for the privilege.
   */
  const openProfile = useCallback(
    (row: Row, entity: Entity) => {
      const person = entity !== 'companies';
      return reveal(person ? 'person' : 'company', {
        name: String((person ? row.full_name : row.name) ?? ''),
        domain: String((person ? row.organization_domain : row.primary_domain) ?? ''),
        apolloId: String(row.id ?? ''),
      });
    },
    [reveal],
  );

  /**
   * Buy the ticked people, in one call.
   *
   * People only. A company row already carries everything the paid search
   * returned, so there is nothing bulk about it to buy — and offering the button
   * anyway would sell a second copy of what is already on screen.
   */
  const revealSelected = useCallback(async () => {
    const ids = Object.keys(state.selected);
    if (ids.length === 0) return;

    dispatch({ type: 'revealing' });
    try {
      const response = await fetch('/api/finder/enrich-bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = (await response.json()) as RevealOutcome & {
        profiles?: Record<string, Record<string, unknown>>;
      };
      dispatch({
        type: 'revealed',
        profiles: data.profiles ?? {},
        outcome: {
          fetched: data.fetched ?? 0,
          cached: data.cached ?? 0,
          capped: Boolean(data.capped),
          unreachable: data.unreachable ?? 0,
          error: data.error,
        },
        credits: data.fetched ?? 0,
      });
    } catch {
      dispatch({
        type: 'revealed',
        profiles: {},
        outcome: {
          fetched: 0,
          cached: 0,
          capped: false,
          unreachable: 0,
          error: 'The reveal could not be sent, so nobody was revealed and nothing was spent.',
        },
        credits: 0,
      });
    }
  }, [state.selected]);

  /**
   * One turn of the conversation.
   *
   * The whole history goes back every time, which is what makes "the second one"
   * resolve against a list shown two turns ago without a session existing
   * anywhere. `pick` carries a chosen company as **structured fields** rather
   * than as free text: sending "I mean Acme (acme.com)" back through the parser
   * produces a company name containing a domain, which resolves to nothing.
   */
  const ask = useCallback(
    async (question: string, pick?: { id: string; domain: string; name: string }) => {
      dispatch({ type: 'ask', question });

      // Read before the dispatch above lands, so the turn being sent is the
      // conversation as it stood when the question was asked.
      const history = state.chat
        .filter((t) => !t.pending && t.content)
        .map((t) => ({ role: t.role, content: t.content }));

      let turn: Turn;
      let context: ChatContext | null | undefined;
      let clearContext = false;

      try {
        const response = await fetch('/api/finder/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: question,
            history,
            selected_org_id: pick?.id ?? '',
            selected_domain: pick?.domain ?? '',
            selected_name: pick?.name ?? '',
            context_org_id: state.chatContext?.org_id ?? '',
            context_domain: state.chatContext?.domain ?? '',
            context_name: state.chatContext?.name ?? '',
          }),
        });
        const data = (await response.json()) as {
          answer?: string;
          choices?: Choice[];
          enrich?: EnrichChip[];
          credits?: number;
          researched?: boolean;
          web_search?: boolean;
          context?: ChatContext | null;
          clear_context?: boolean;
        };

        turn = {
          role: 'assistant',
          content: data.answer ?? 'Something went wrong answering that.',
          choices: data.choices,
          enrich: data.enrich,
          credits: data.credits,
          researched: data.researched,
          web_search: data.web_search,
        };
        context = data.context ?? undefined;
        clearContext = Boolean(data.clear_context);
      } catch {
        turn = {
          role: 'assistant',
          content:
            'That could not be sent, so nothing was looked up and nothing was spent. Try again in a moment.',
        };
      }

      dispatch({ type: 'answered', turn, context, clearContext });
    },
    [state.chat, state.chatContext],
  );

  /**
   * Read a sentence into the filters.
   *
   * Fills and stops. It deliberately does not run the search afterwards: the
   * point of a parser you can see is being able to correct it before it costs
   * anything, and a parser that searched on your behalf would be one you had to
   * pay to disagree with.
   */
  const fill = useCallback(async (text: string) => {
    dispatch({ type: 'filling' });

    try {
      const response = await fetch('/api/finder/parse-query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as {
        filters?: Record<string, unknown>;
        entity?: string;
        read_company_as?: { typed: string; as: string } | null;
        unclear?: boolean;
        error?: string;
      };

      if (!response.ok || data.error) {
        dispatch({
          type: 'fillFailed',
          outcome: {
            set: [],
            ignored: [],
            readAs: null,
            unclear: false,
            error: data.error ?? 'That could not be read into filters.',
          },
        });
        return;
      }

      const entity: Entity = data.entity === 'companies' ? 'companies' : 'people';
      const mapped = panelFromFilters(entity, data.filters ?? {});

      dispatch({
        type: 'filled',
        entity,
        values: mapped.values,
        outcome: {
          set: mapped.set,
          ignored: mapped.ignored,
          readAs: data.read_company_as ?? null,
          unclear: Boolean(data.unclear) || mapped.set.length === 0,
        },
      });
    } catch {
      dispatch({
        type: 'fillFailed',
        outcome: {
          set: [],
          ignored: [],
          readAs: null,
          unclear: false,
          error: 'That could not be sent. Setting the filters by hand still works.',
        },
      });
    }
  }, []);

  /**
   * Put rows on the working list.
   *
   * Sent as the rows themselves rather than as ids, so a row somebody has
   * already revealed carries its contact details onto the list. Re-fetching by
   * id later would either lose the reveal or charge for it a second time.
   */
  const addToList = useCallback(
    async (rows: Row[], entity: Entity) => {
      if (rows.length === 0) return;
      try {
        const out = await fetch('/api/finder/list', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entity, rows }),
        }).then((r) => r.json() as Promise<{ count?: number }>);
        dispatch({ type: 'listCount', count: out.count ?? 0 });
      } catch {
        // The list is a convenience; failing to add to it is not worth an alarm.
      }
    },
    [],
  );

  /**
   * Build the file in the browser's own download.
   *
   * A form post rather than a fetch, because a fetch would hand the bytes to
   * JavaScript and leave it to reconstruct a download from a blob — and the
   * rows are already a large POST body that has no business being held twice
   * in memory.
   */
  const exportRows = useCallback(
    (entity: Entity, rows: Row[], format: 'xlsx' | 'csv') => {
      if (rows.length === 0) return;
      const body = {
        entity,
        rows,
        format,
        filters: toFilters(entity, state.values),
        meta: {
          total: state.total,
          rejected: state.rejected ?? {},
        },
      };

      void fetch('/api/finder/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('export failed');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download =
            response.headers
              .get('content-disposition')
              ?.match(/filename="([^"]+)"/)?.[1] ?? `contact-finder.${format}`;
          link.click();
          URL.revokeObjectURL(url);
        })
        .catch(() => {});
    },
    [state.values, state.total, state.rejected],
  );

  /** Reopen a saved entry. Costs nothing, which is the entire point of it. */
  const reopen = useCallback(async (id: number) => {
    try {
      const entry = await fetch(`/api/finder/history/${id}`).then(
        (r) =>
          r.json() as Promise<{
            entity?: string;
            filters?: Record<string, unknown>;
            rows?: Row[];
            total?: number | null;
          }>,
      );
      const entity: Entity = entry.entity === 'companies' ? 'companies' : 'people';
      const panel = (entry.filters?.panel ?? {}) as PanelValues;

      dispatch({
        type: 'reopen',
        entity,
        // Falls back to the defaults rather than to an empty object: a panel
        // with no `include_similar_titles` reads as somebody having turned it
        // off, which is a different search from one saved before it was stored.
        values: Object.keys(panel).length > 0 ? panel : INITIAL.values,
        rows: entry.rows ?? [],
        total: entry.total ?? null,
        id,
      });
    } catch {
      dispatch({ type: 'drawer', drawer: null });
    }
  }, []);

  const ids = state.results.map(rowId).filter(Boolean);
  const selectedCount = Object.keys(state.selected).length;
  const shown = state.shownEntity ?? 'people';

  /**
   * What the free actions operate on: the ticked rows, or all of them.
   *
   * Deliberately not "the ticked rows, or nothing". Adding a whole page to the
   * list and exporting a whole page are both ordinary things to want, and making
   * somebody tick twenty-four boxes first is a toll rather than a safeguard —
   * neither action costs anything or can be got wrong expensively.
   */
  const pickedRows =
    selectedCount > 0 ? state.results.filter((r) => state.selected[rowId(r)]) : state.results;

  /**
   * How many filters are set, for the collapsed rail's badge.
   *
   * The two settings about HOW to search are excluded, for the same reason the
   * chip bar leaves them out: neither narrows anything, and counting them would
   * make an untouched panel claim two filters.
   */
  const setFilterCount = Object.entries(state.values).filter(([key, value]) => {
    if (key === 'include_similar_titles' || key === 'company_detail') return false;
    if (value === undefined || value === null || value === '' || value === false) return false;
    return !(Array.isArray(value) && value.length === 0);
  }).length;

  /**
   * The conversation, wherever it happens to be living.
   *
   * One element rendered in two places rather than two copies: the rail on a
   * wide screen and a sheet below that. Two copies would each hold their own
   * scroll position and their own draft message, and switching breakpoints would
   * silently throw one of them away.
   */
  const chat = (
    <Chat
      turns={state.chat}
      busy={state.chatBusy}
      context={state.chatContext}
      onSend={(text) => void ask(text)}
      onPick={(choice) =>
        void ask(`I mean ${choice.name ?? choice.domain}`, {
          id: choice.id ?? '',
          domain: choice.domain,
          name: choice.name ?? '',
        })
      }
      onReveal={(chip) =>
        void reveal('person', {
          name: chip.name,
          domain: chip.domain,
          apolloId: chip.apollo_id,
        })
      }
      onUnpin={() => dispatch({ type: 'unpin' })}
    />
  );

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[26rem_minmax(0,1fr)] 2xl:grid-cols-[26rem_minmax(0,1fr)_24rem]">
      {/*
        ── The filters ──

        The sticky lives on this wrapper rather than on the panel itself.
        `.a-ring` sets `position: relative` on anything not carrying `.fixed`,
        `.absolute` or `.sticky`, and a responsive `xl:sticky` is not that class,
        so putting both on one element left the rail scrolling away with the
        page while looking like it should not.
      */}
      <div className="xl:sticky xl:top-4 xl:self-start">
      <aside
        // Content-sized below `xl`, where this is a disclosure sitting on top
        // of the results rather than a column beside them — a fixed height
        // there would be a slab of empty rail on a phone with three fields set.
        // Fixed from `xl` up, where the aside stands beside a chat rail that is
        // this tall regardless of how long the conversation is, so a filter
        // panel that stopped at its own content looked like the shorter,
        // lesser-considered surface next to it.
        className="surface-lit a-ring flex max-h-[calc(100vh-11rem)] flex-col rounded-2xl p-3.5 xl:h-[calc(100vh-11rem)]"
      >
        {/*
          Filters vs Activity. History, the working list and this month's
          spend used to sit above the results instead — a place that has
          nothing to do with what they are. None of the three describe the
          current search; they describe every search, which is a property of
          this rail, not of whichever result set happens to be on screen.
        */}
        <div
          role="radiogroup"
          aria-label="Filter panel section"
          className="surface-sunken mb-3 flex shrink-0 rounded-xl border p-1"
        >
          {(
            [
              ['filters', 'Filters', SlidersHorizontal],
              ['activity', 'Activity', Clock],
            ] as const
          ).map(([value, label, Icon]) => {
            const on = panelTab === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPanelTab(value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition',
                  on
                    ? 'gradient-brand text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]'
                    : 'text-muted hover:text-[var(--text-c)]',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {value === 'activity' && state.listCount > 0 && (
                  <span
                    className={cn(
                      'numeric rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      on ? 'bg-white/20 text-white' : 'gradient-brand text-white',
                    )}
                  >
                    {state.listCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {panelTab === 'filters' ? (
          <>
            {/*
              Above the People/Companies switch, because a sentence decides
              which one it belongs on. Below nothing else on this tab, because
              it is the first thing most people will try.
            */}
            <div className="mb-3 shrink-0">
              <AskBar
                onFill={(text) => void fill(text)}
                busy={state.filling}
                outcome={state.fill}
                onDismiss={() => dispatch({ type: 'dismissFill' })}
              />
            </div>

            {/*
              Below the width where this becomes a column of its own, forty
              filters sit between somebody and their own results. The
              disclosure is only rendered there: at `xl` and above the rail is
              beside the results, not on top of them, and a collapse would be
              a click for nothing.
            */}
            <button
              type="button"
              onClick={() => setRailOpen((o) => !o)}
              aria-expanded={railOpen}
              className="surface-sunken text-muted mb-3 flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)] xl:hidden"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              {railOpen ? 'Hide filters' : 'Set filters by hand'}
              {setFilterCount > 0 && (
                <span className="gradient-brand ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {setFilterCount}
                </span>
              )}
            </button>

            <div
              role="radiogroup"
              aria-label="What to search for"
              className={cn(
                'surface-sunken mb-3 shrink-0 rounded-xl border p-1',
                railOpen ? 'flex' : 'hidden xl:flex',
              )}
            >
              {(
                [
                  ['people', 'People', Users],
                  ['companies', 'Companies', Building2],
                ] as const
              ).map(([value, label, Icon]) => {
                const on = state.entity === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => dispatch({ type: 'entity', entity: value })}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition',
                      on
                        ? 'gradient-brand text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)]'
                        : 'text-muted hover:text-[var(--text-c)]',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>

            <FilterPanel
              entity={state.entity}
              values={state.values}
              set={set}
              onClear={() => dispatch({ type: 'clear' })}
              onSearch={() => void search(true)}
              loading={state.loading}
              count={state.count}
              counting={state.counting}
              showFields={railOpen}
            />
          </>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            <button
              type="button"
              onClick={() => dispatch({ type: 'drawer', drawer: 'history' })}
              className="surface-lit a-ring text-muted flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
            >
              <Clock className="size-4" aria-hidden />
              History
            </button>

            <button
              type="button"
              onClick={() => dispatch({ type: 'drawer', drawer: 'list' })}
              className="surface-lit a-ring text-muted flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
            >
              <ListPlus className="size-4" aria-hidden />
              List
              {state.listCount > 0 && (
                <span className="numeric tinted ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold">
                  {state.listCount}
                </span>
              )}
            </button>

            <div className="border-t pt-3">
              <CreditLine watched={state.spent} />
            </div>
          </div>
        )}
      </aside>
      </div>

      {/* ── The results ──

        The bottom padding clears the floating Ask button at the widths where it
        exists. Load more runs the full width of this column, and it was landing
        underneath it. */}
      <section className="min-w-0 space-y-3 pb-16 2xl:pb-0">
        {/*
          The workspace bar. Everything here is free — nothing on this row can
          spend a credit — which is why it sits above the results rather than
          among the buttons that can.
        */}
        {state.results.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void addToList(pickedRows, shown)}
              className="surface-lit a-ring text-muted inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
            >
              <ListPlus className="size-3.5" aria-hidden />
              {selectedCount > 0 ? `Add ${selectedCount} to list` : 'Add all to list'}
            </button>

            {(
              [
                ['xlsx', 'Excel'],
                ['csv', 'CSV'],
              ] as const
            ).map(([format, label]) => (
              <button
                key={format}
                type="button"
                onClick={() => exportRows(shown, pickedRows, format)}
                title={
                  format === 'xlsx'
                    ? 'A workbook, with a second sheet saying what search produced these rows'
                    : 'A flat table, no second sheet, for importing somewhere else'
                }
                className="surface-lit a-ring text-muted inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
              >
                <Download className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        )}

        <QueryBar
          values={state.values}
          onRemove={(key) => dispatch({ type: 'set', key, value: undefined })}
        />

        {state.failure && (
          <div
            className="a-ring rounded-2xl border px-3.5 py-3 text-sm"
            style={{ background: 'color-mix(in oklab, var(--h-rose) 8%, var(--surface-raised))' }}
          >
            {state.failure}
          </div>
        )}

        {state.notice && (
          <div className="surface-lit a-ring text-muted rounded-2xl px-3.5 py-3 text-sm">
            {state.notice}
          </div>
        )}

        {state.choices && (
          <div className="surface-lit a-ring rounded-2xl px-3.5 py-3">
            <p className="text-sm">
              That name matches more than one company. Which did you mean?
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.choices.map((c) => (
                <button
                  key={c.id ?? c.domain}
                  type="button"
                  onClick={() => {
                    const values = { ...state.values, company_domains: c.domain || c.name || '' };
                    void search(true, { values });
                  }}
                  className="surface-sunken rounded-lg border px-2.5 py-1.5 text-left text-xs transition hover:border-[var(--border-strong)]"
                >
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-subtle block">{c.domain || c.hq || 'no domain on file'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.invalidCodes && <InvalidCodes codes={state.invalidCodes} />}

        {state.rejected && (
          <RejectionBanner
            shown={state.results.length}
            rejected={state.rejected}
            labels={state.rejectedLabels}
            total={state.rejectedTotal}
            unconfirmed={state.unconfirmed}
            shownEntity={state.shownEntity}
            onRelax={relax}
          />
        )}

        {state.results.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted text-sm">
              <span className="numeric font-semibold text-[var(--text-c)]">
                {state.results.length.toLocaleString('en-IN')}
              </span>{' '}
              {shown === 'companies' ? 'companies' : 'people'}
              {state.total != null && (
                <span className="text-subtle">
                  {' '}
                  of {state.total.toLocaleString('en-IN')}
                </span>
              )}
              {state.resolved?.[0] && (
                <span className="text-subtle"> at {state.resolved[0]}</span>
              )}
            </p>

            {state.described && state.described.orgs > 0 && (
              <p className="text-subtle text-xs">
                {state.described.orgs} employers described
                {state.described.fetched === 0
                  ? ', all from cache'
                  : `, ${state.described.fetched} newly fetched`}
              </p>
            )}

            <span className="flex-1" />

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'clearSelection' })}
                className="text-subtle text-xs hover:text-[var(--text-c)]"
              >
                {selectedCount} selected · clear
              </button>
            )}

            {/*
              People only, and only when something is ticked. A company row
              already holds everything the paid search returned, so a bulk
              button on that tab would sell a second copy of what is on screen.
            */}
            {selectedCount > 0 && shown === 'people' && (
              <button
                type="button"
                onClick={() => void revealSelected()}
                disabled={state.revealing}
                title="Buys the full record for each ticked person: contact details, real surname, employer. About one credit each, and nothing for anyone already bought."
                className="gradient-brand inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)] transition disabled:opacity-60"
              >
                <Sparkles className="size-3.5" aria-hidden />
                {state.revealing ? 'Revealing…' : `Reveal ${selectedCount}`}
              </button>
            )}

            <button
              type="button"
              onClick={() => dispatch({ type: 'selectAll', ids })}
              className="text-muted rounded-lg border px-2 py-1 text-xs transition hover:border-[var(--border-strong)]"
            >
              Select all
            </button>

            <div className="surface-sunken flex rounded-lg border p-0.5" role="group" aria-label="Layout">
              {(
                [
                  ['cards', LayoutGrid],
                  ['table', Rows3],
                ] as const
              ).map(([v, Icon]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={state.view === v}
                  aria-label={`${v} view`}
                  onClick={() => dispatch({ type: 'view', view: v })}
                  className={cn(
                    'rounded-md px-2 py-1 transition',
                    state.view === v
                      ? 'elev-1 bg-[var(--surface-raised)]'
                      : 'text-subtle hover:text-[var(--text-c)]',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        )}

        {state.reveal && <RevealNote outcome={state.reveal} />}

        {state.results.length > 0 ? (
          <Results
            rows={state.results}
            entity={shown}
            view={state.view}
            selected={state.selected}
            toggle={(id) => dispatch({ type: 'toggle', id })}
            open={(row) => void openProfile(row, shown)}
          />
        ) : (
          !state.loading &&
          !state.failure &&
          /*
           * Nothing at all before a search has run — the filter rail grew into
           * this column's width for exactly this state, and a placeholder
           * sitting in it would waste the width just handed over.
           *
           * "Nothing matched" stays, because it is not idle: a search ran and
           * came back empty, which is a fact about that search and belongs on
           * screen for the same reason a rejection banner does. Silence here
           * would read as the search never having happened at all.
           */
          state.shownEntity && (
            <div className="surface-lit a-ring flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <span className="surface-sunken a-ring text-subtle grid size-9 shrink-0 place-items-center rounded-xl border">
                <Search className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Nothing matched</p>
                <p className="text-muted text-xs leading-relaxed">
                  Apollo answered and had nothing for these filters. Widening one of them is the
                  usual fix.
                </p>
              </div>
            </div>
          )
        )}

        {state.hasMore && state.results.length > 0 && (
          <button
            type="button"
            onClick={() => void search(false)}
            disabled={state.loading}
            className="surface-lit a-ring w-full rounded-2xl py-2.5 text-sm font-medium transition hover:border-[var(--border-strong)] disabled:opacity-60"
          >
            {state.loading ? 'Loading…' : 'Load more'}
          </button>
        )}

        {state.historyTruncated && (
          /*
           * A paged search that outgrew what one history entry holds. Said here
           * rather than left silent: without it the drawer reopens 120 rows and
           * calls that the whole search, and the only clue is a reader noticing
           * the count is short.
           */
          <p className="text-subtle text-xs leading-relaxed">
            History keeps the first{' '}
            <span className="numeric font-semibold">{state.historyTruncated.kept}</span> of these{' '}
            <span className="numeric font-semibold">{state.historyTruncated.of}</span> rows.
            Reopening this later will show that many; export now to keep all of them.
          </p>
        )}
      </section>

      {/*
        ── The conversation ──

        A third rail only where there is genuinely room for three: below that it
        is a sheet, opened from the button that floats over the results. Squeezed
        into a narrow third column it would be too thin to read an answer in, and
        stacked under the grid it would be below the fold on every screen.
      */}
      <div className="hidden 2xl:block">
        <div className="sticky top-4 self-start">
          <aside className="surface-lit a-ring flex h-[calc(100vh-11rem)] flex-col rounded-2xl p-3.5">
            {chat}
          </aside>
        </div>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'chatOpen', open: true })}
        /*
          Above the phone dock rather than behind it. The dock is fixed to the
          bottom below `lg` at z-40, so a button at `bottom-4` and z-30 sat
          underneath it and could not be pressed at exactly the widths it exists
          for.
        */
        className="gradient-brand elev-3 fixed right-4 bottom-[5.5rem] z-40 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.22)] lg:bottom-6 2xl:hidden"
      >
        <MessagesSquare className="size-4" aria-hidden />
        Ask
        {state.chat.length > 0 && (
          <span className="numeric rounded-full bg-white/20 px-1.5 text-[11px] font-semibold">
            {state.chat.filter((t) => t.role === 'assistant' && !t.pending).length}
          </span>
        )}
      </button>

      <Drawer
        open={state.chatOpen}
        onClose={() => dispatch({ type: 'chatOpen', open: false })}
        title="Ask about a company or a person"
        width="lg"
        fill
      >
        {/* `fill` because the conversation does its own scrolling: the answers
            move and the composer stays on the bottom edge. Without it the
            drawer wraps a second scrolling region around that one. */}
        {chat}
      </Drawer>

      {state.profile && (
        <ProfilePanel
          profile={state.profile}
          credits={state.profile.credits}
          onClose={() => dispatch({ type: 'closeProfile' })}
        />
      )}

      <HistoryDrawer
        open={state.drawer === 'history'}
        onClose={() => dispatch({ type: 'drawer', drawer: null })}
        onReopen={(id) => void reopen(id)}
      />

      <ListDrawer
        open={state.drawer === 'list'}
        onClose={() => dispatch({ type: 'drawer', drawer: null })}
        onCount={(count) => dispatch({ type: 'listCount', count })}
        onExport={(entity, rows) => exportRows(entity, rows, 'xlsx')}
      />
    </div>
  );
}

/**
 * What a bulk reveal actually did.
 *
 * Four separate facts, and collapsing any of them into "revealed 40 people"
 * loses something a reader needs. Bought and already-owned are different prices.
 * Unreachable is not a miss: those ids were never billed and are free to ask for
 * again, which is the opposite of what "Apollo has nothing on them" implies.
 */
function RevealNote({ outcome }: { outcome: RevealOutcome }) {
  if (outcome.error) {
    return (
      <div
        className="a-ring rounded-2xl border px-3.5 py-3 text-sm"
        style={{ background: 'color-mix(in oklab, var(--h-rose) 8%, var(--surface-raised))' }}
      >
        {outcome.error}
      </div>
    );
  }

  const parts: string[] = [];
  if (outcome.fetched > 0) parts.push(`${outcome.fetched} bought`);
  if (outcome.cached > 0) parts.push(`${outcome.cached} already on file, free`);
  if (parts.length === 0) parts.push('nobody new');

  return (
    <div className="surface-lit a-ring rounded-2xl px-3.5 py-2.5 text-sm">
      <p className="text-muted">
        <Sparkles
          className="mr-1.5 inline size-3.5 align-[-2px]"
          style={{ color: 'var(--h-amber)' }}
          aria-hidden
        />
        {parts.join(' · ')}
        {outcome.capped && ' · more than 50 were ticked, so the rest were left alone'}
      </p>
      {outcome.unreachable > 0 && (
        <p className="text-subtle mt-1 text-xs leading-relaxed">
          <span className="numeric font-semibold">{outcome.unreachable}</span> could not be reached
          — Apollo did not answer for them, so they were neither revealed nor ruled out. Nothing was
          charged, so ticking them again is free.
        </p>
      )}
    </div>
  );
}

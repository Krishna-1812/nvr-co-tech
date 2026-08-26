'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Building2, Coins, LayoutGrid, Rows3, Search, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/primitives';
import { InvalidCodes, QueryBar, RejectionBanner } from './Banners';
import { FilterPanel } from './FilterPanel';
import { ProfilePanel } from './Profile';
import { Results } from './Results';
import { toFilters, type Entity } from './filters';
import { INITIAL, reducer, rowId, type RevealOutcome, type Row, type SearchOutcome } from './store';

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
    },
    [state.entity, state.values, state.page],
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
   * Open one row's full record.
   *
   * The kind comes from `shownEntity` — what the rows on screen actually are —
   * rather than from the panel, which may have been flipped to the other tab
   * since the search ran. Getting that wrong sends a person's Apollo id to the
   * company endpoint, which matches nothing and bills for the privilege.
   */
  const openProfile = useCallback(
    async (row: Row, kind: Entity) => {
      const person = kind !== 'companies';
      const subject = {
        name: String((person ? row.full_name : row.name) ?? ''),
        domain: String((person ? row.organization_domain : row.primary_domain) ?? ''),
        apolloId: String(row.id ?? ''),
      };

      dispatch({ type: 'openProfile', kind: person ? 'person' : 'company', subject });

      try {
        const response = await fetch('/api/finder/enrich', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: person ? 'person' : 'company',
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

  const ids = state.results.map(rowId).filter(Boolean);
  const selectedCount = Object.keys(state.selected).length;
  const shown = state.shownEntity ?? 'people';

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      {/*
        ── The filters ──

        The sticky lives on this wrapper rather than on the panel itself.
        `.a-ring` sets `position: relative` on anything not carrying `.fixed`,
        `.absolute` or `.sticky`, and a responsive `xl:sticky` is not that class,
        so putting both on one element left the rail scrolling away with the
        page while looking like it should not.
      */}
      <div className="xl:sticky xl:top-4 xl:self-start">
      <aside className="surface-lit a-ring flex max-h-[calc(100vh-11rem)] flex-col rounded-2xl p-3.5">
        <div
          role="radiogroup"
          aria-label="What to search for"
          className="surface-sunken mb-3 flex shrink-0 rounded-xl border p-1"
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
        />
      </aside>
      </div>

      {/* ── The results ── */}
      <section className="min-w-0 space-y-3">
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
          !state.failure && (
            <div className="surface-lit a-ring rounded-2xl">
              <EmptyState
                icon={<Search className="size-6" aria-hidden />}
                title={state.shownEntity ? 'Nothing matched' : 'Set a filter and search'}
                description={
                  state.shownEntity
                    ? 'Apollo answered and had nothing for these filters. Widening one of them is the usual fix.'
                    : 'Pick a title, a seniority, an industry or a company on the left. The count under the button updates as you go, and finding people costs nothing.'
                }
              />
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

        {state.spent > 0 && (
          <p className="text-subtle flex items-center gap-1.5 text-xs">
            <Coins className="size-3.5" aria-hidden />
            {/*
              What this browser watched being spent since the page loaded. Not a
              balance: nothing reachable with this key reports the account total,
              so a number called "remaining" would be a guess.
            */}
            {state.spent} {state.spent === 1 ? 'credit' : 'credits'} spent on this page
          </p>
        )}
      </section>

      {state.profile && (
        <ProfilePanel
          profile={state.profile}
          credits={state.profile.credits}
          onClose={() => dispatch({ type: 'closeProfile' })}
        />
      )}
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

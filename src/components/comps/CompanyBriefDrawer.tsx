'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Markdown } from '@/components/assist/Markdown';
import { Skeleton } from '@/components/ui/primitives';
import { crore, percent, shortDate } from '@/lib/comps/format';
import { formatMultiple, isKnown, revenueGrowth } from '@/lib/comps/multiples';
import { METHOD_LABEL, PICK } from '@/lib/comps/view';
import type { Comparable, MethodKey } from '@/lib/comps/types';

/**
 * A peer, opened up.
 *
 * The registry section renders the instant a row is clicked — every figure it
 * needs is already sitting in the `Comparable` the table built, so there is
 * nothing to wait for. Only the AI section calls the network, because it is
 * the only part that costs money and can be wrong: it is clearly separated
 * from the figures above it, sourced, and dated, so a reader never mistakes a
 * model's sentence for a number this platform stands behind.
 */

const MULTIPLES: MethodKey[] = ['ev_revenue', 'ev_ebitda', 'pe'];

type Citation = { title: string; url: string };

type BriefState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; markdown: string; citations: Citation[]; generatedAt: string; cached: boolean };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-subtle text-[11px]">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-3.5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="mt-4 h-3.5 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

export function CompanyBriefDrawer({
  comparable,
  onClose,
}: {
  comparable: Comparable | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<BriefState>({ status: 'loading' });
  const loadedFor = useRef<string | null>(null);

  /*
   * The last company shown, kept a beat past `comparable` going null.
   *
   * `Drawer` plays a close animation, and that only happens if it stays
   * mounted with `open` going from true to false — unmounting it outright the
   * instant a row is deselected would make it vanish rather than slide away,
   * and for the same beat its title and figures would already be gone. This is
   * the same pattern TenantBoard's own drawer uses for a person's profile.
   */
  const [shown, setShown] = useState<Comparable | null>(null);
  if (comparable && comparable !== shown) setShown(comparable);

  async function load(companyId: string, force: boolean) {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/comps/brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ companyId, force }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setState({ status: 'error', message: data?.error ?? 'Something went wrong while researching this company.' });
        return;
      }
      setState({
        status: 'ready',
        markdown: data.markdown,
        citations: Array.isArray(data.citations) ? data.citations : [],
        generatedAt: data.generatedAt,
        cached: !!data.cached,
      });
    } catch {
      setState({ status: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    }
  }

  useEffect(() => {
    if (!comparable) return;
    if (loadedFor.current === comparable.companyId) return;
    loadedFor.current = comparable.companyId;
    void load(comparable.companyId, false);
    // `load` closes over nothing that changes between calls for the same id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparable?.companyId]);

  const c = shown;

  const netDebt =
    c && (isKnown(c.totalDebt) || isKnown(c.cash))
      ? (isKnown(c.totalDebt) ? c.totalDebt : 0) - (isKnown(c.cash) ? c.cash : 0)
      : null;

  return (
    <Drawer
      open={!!comparable}
      onClose={() => {
        loadedFor.current = null;
        onClose();
      }}
      title={c?.name ?? ''}
      width="lg"
      header={
        c && (
          <div className="text-muted mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="tinted rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
              {c.listingStatus}
            </span>
            <span>{c.country}</span>
            {c.industry && (
              <>
                <span aria-hidden className="text-subtle">
                  ·
                </span>
                <span>{c.industry}</span>
              </>
            )}
          </div>
        )
      }
    >
      {c && (
        <>
          <section className="mb-6">
            <h3 className="text-subtle mb-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase">
              From the registry
            </h3>
            <dl className="surface-sunken grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-3">
              <Stat label="Period" value={shortDate(c.periodEnd)} />
              <Stat label="Revenue" value={crore(c.revenue, { symbol: false })} />
              <Stat label="Growth" value={percent(revenueGrowth(c))} />
              <Stat label="EBITDA" value={crore(c.ebitda, { symbol: false })} />
              <Stat label="Market cap" value={crore(c.marketCap, { symbol: false })} />
              <Stat label="Net debt" value={crore(netDebt, { symbol: false })} />
              <Stat label="EV" value={crore(c.multiples.enterpriseValue, { symbol: false })} />
              {MULTIPLES.map((m) => (
                <Stat key={m} label={METHOD_LABEL[m]} value={formatMultiple(PICK[m](c))} />
              ))}
            </dl>
          </section>

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-subtle text-[11px] font-semibold tracking-[0.06em] uppercase">AI research</h3>
              {state.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => load(c.companyId, true)}
                  className="text-subtle inline-flex items-center gap-1 text-xs transition hover:text-[var(--text-c)]"
                >
                  <RefreshCw className="size-3" aria-hidden />
                  Refresh
                </button>
              )}
            </div>

            {state.status === 'loading' && <BriefSkeleton />}

            {state.status === 'error' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--status-warn)]/30 bg-[var(--status-warn)]/8 p-3.5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--status-warn)]" aria-hidden />
                <span>{state.message}</span>
              </div>
            )}

            {state.status === 'ready' && (
              <>
                <Markdown source={state.markdown} />

                {state.citations.length > 0 && (
                  <div className="mt-4 border-t pt-3.5">
                    <p className="text-subtle mb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase">
                      Sources
                    </p>
                    <ul className="space-y-1">
                      {state.citations.map((cite) => (
                        <li key={cite.url}>
                          <a
                            href={cite.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 dark:text-brand-300 inline-flex max-w-full items-center gap-1 text-xs hover:underline"
                          >
                            <ExternalLink className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{cite.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-subtle mt-4 text-[11px] leading-relaxed">
                  {state.cached ? 'Cached brief, generated' : 'Generated'} {shortDate(state.generatedAt)} by an AI
                  model with web search. Check the sources before relying on it — this section is not registry data.
                </p>
              </>
            )}
          </section>
        </>
      )}
    </Drawer>
  );
}

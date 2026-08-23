'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { WideModal } from '@/components/ui/Drawer';
import { Skeleton } from '@/components/ui/primitives';
import { crore, percent, shortDate } from '@/lib/comps/format';
import { formatMultiple, isKnown, revenueGrowth } from '@/lib/comps/multiples';
import { METHOD_LABEL, PICK } from '@/lib/comps/view';
import type { Comparable, MethodKey } from '@/lib/comps/types';
import type { BriefContent, Severity, Tone } from '@/lib/comps/brief';
import { cn } from '@/lib/utils';

/**
 * A peer, opened up.
 *
 * Centred, like Profile.tsx's person modal, and for the same reason: this is
 * the richest surface the screen offers, setting the registry's own numbers
 * against a researched read of the business, and it is meant to be studied
 * rather than glanced at beside a table — a side drawer is right for a
 * drill-down list, not for the thing you came here to read.
 *
 * The registry section renders the instant a row is clicked — every figure it
 * needs is already sitting in the `Comparable` the table built. Only the AI
 * section calls the network, because it is the only part that costs money and
 * can be wrong: it is rendered as tiles, a timeline and tagged lists rather
 * than a wall of markdown, because a reviewer scanning six peers in a row
 * needs to find the one fact that matters, not read four paragraphs six times.
 */

const MULTIPLES: MethodKey[] = ['ev_revenue', 'ev_ebitda', 'pe'];

type Citation = { title: string; url: string };

type BriefState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; content: BriefContent; citations: Citation[]; generatedAt: string; cached: boolean };

const TONE_COLOR: Record<Tone, string> = {
  positive: 'var(--h-emerald)',
  neutral: 'var(--text-subtle)',
  negative: 'var(--h-rose)',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  low: 'var(--h-emerald)',
  medium: 'var(--h-amber)',
  high: 'var(--h-rose)',
};

const REGISTRY_TILE_ACCENT = [
  'var(--h-indigo)',
  'var(--h-emerald)',
  'var(--h-cyan)',
  'var(--h-violet)',
  'var(--h-amber)',
  'var(--h-indigo)',
  'var(--h-lime)',
  'var(--h-cyan)',
  'var(--h-violet)',
  'var(--h-magenta)',
];

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
   * `WideModal` plays a close animation, and that only happens if it stays
   * mounted with `open` going from true to false — unmounting it outright the
   * instant a row is deselected would make it vanish rather than fade away,
   * and for the same beat its title and figures would already be gone.
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
      if (!res.ok || !data?.content) {
        setState({ status: 'error', message: data?.error ?? 'Something went wrong while researching this company.' });
        return;
      }
      setState({
        status: 'ready',
        content: data.content as BriefContent,
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

  const registryTiles = c
    ? [
        { label: 'Period', value: shortDate(c.periodEnd) },
        { label: 'Revenue', value: crore(c.revenue, { symbol: false }) },
        { label: 'Growth', value: percent(revenueGrowth(c)) },
        { label: 'EBITDA', value: crore(c.ebitda, { symbol: false }) },
        { label: 'Market cap', value: crore(c.marketCap, { symbol: false }) },
        { label: 'Net debt', value: crore(netDebt, { symbol: false }) },
        { label: 'EV', value: crore(c.multiples.enterpriseValue, { symbol: false }) },
        ...MULTIPLES.map((m) => ({ label: METHOD_LABEL[m], value: formatMultiple(PICK[m](c)) })),
      ]
    : [];

  return (
    <WideModal open={!!comparable} onClose={onClose} title={c?.name ?? ''}>
      {c && (
        <>
          {/* ── Hero ───────────────────────────────────────────────────────── */}
          <div
            className="border-b px-6 py-6"
            style={{
              background: 'linear-gradient(160deg, color-mix(in oklab, var(--h-violet) 9%, transparent), transparent 60%)',
            }}
          >
            <h2 className="text-[1.5rem] leading-tight font-semibold tracking-tight text-pretty pr-10">
              {c.name}
            </h2>
            <div className="text-muted mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
              <span className="tinted rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase" style={{ ['--tone' as string]: 'var(--h-violet)' }}>
                {c.listingStatus}
              </span>
              <span>{c.country}</span>
              {c.industry && (
                <>
                  <span aria-hidden className="text-subtle">·</span>
                  <span>{c.industry}</span>
                </>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {registryTiles.map((t, i) => (
                <Tile key={t.label} label={t.label} value={t.value} accent={REGISTRY_TILE_ACCENT[i % REGISTRY_TILE_ACCENT.length]} />
              ))}
            </div>
          </div>

          {/* ── AI research ────────────────────────────────────────────────── */}
          <div className="px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="a-label">AI research</h3>
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

            {state.status === 'ready' && <Brief content={state.content} />}
          </div>

          {state.status === 'ready' && (
            <div className="border-t px-6 py-4">
              {state.citations.length > 0 && (
                <>
                  <p className="text-subtle mb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase">
                    Sources
                  </p>
                  <ul className="mb-3 space-y-1">
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
                </>
              )}
              <p className="text-subtle text-[11px] leading-relaxed">
                {state.cached ? 'Cached brief, generated' : 'Generated'} {shortDate(state.generatedAt)} by an AI
                model with web search. Check the sources before relying on it — this section is not registry data.
              </p>
            </div>
          )}
        </>
      )}
    </WideModal>
  );
}

/** The structured brief, in full: quick facts, a timeline, a two-column read
 *  on competitors, and tagged risks — never a paragraph on its own. */
function Brief({ content }: { content: BriefContent }) {
  const hasCompetitive =
    content.competitivePosition.summary ||
    content.competitivePosition.strengths.length > 0 ||
    content.competitivePosition.challenges.length > 0;

  return (
    <div className="space-y-6">
      <p className="text-[13.5px] leading-relaxed text-pretty">{content.overview}</p>

      {content.highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {content.highlights.map((h) => (
            <div key={h.label} className="surface-sunken rounded-xl border px-3 py-2.5">
              <p className="a-label text-[9.5px]">{h.label}</p>
              <p className="mt-0.5 truncate text-[13px] font-semibold" title={h.value}>
                {h.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {content.recentDevelopments.length > 0 && (
        <section>
          <h4 className="a-label mb-2.5">Recent developments</h4>
          <ol className="space-y-2">
            {content.recentDevelopments.map((d, i) => (
              <li
                key={i}
                className="rounded-xl border border-l-[3px] py-2.5 pr-3 pl-3.5"
                style={{ borderLeftColor: TONE_COLOR[d.tone] }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-[13px] font-semibold text-pretty">{d.title}</p>
                  {d.when && <p className={cn('text-subtle shrink-0 text-[11px]', 'numeric')}>{d.when}</p>}
                </div>
                <p className="text-muted mt-1 text-[12.5px] leading-relaxed text-pretty">{d.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasCompetitive && (
        <section>
          <h4 className="a-label mb-2.5">Competitive position</h4>
          {content.competitivePosition.summary && (
            <p className="text-muted mb-3 text-[12.5px] leading-relaxed text-pretty">
              {content.competitivePosition.summary}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <PointList
              label="Strengths"
              icon={<TrendingUp className="size-3.5" aria-hidden />}
              tone="var(--h-emerald)"
              items={content.competitivePosition.strengths}
            />
            <PointList
              label="Challenges"
              icon={<TrendingDown className="size-3.5" aria-hidden />}
              tone="var(--h-amber)"
              items={content.competitivePosition.challenges}
            />
          </div>
        </section>
      )}

      {content.keyRisks.length > 0 && (
        <section>
          <h4 className="a-label mb-2.5">Key risks</h4>
          <ul className="space-y-2">
            {content.keyRisks.map((r, i) => (
              <li key={i} className="rounded-xl border px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="text-[13px] font-semibold text-pretty">{r.risk}</p>
                  <span
                    className="tinted shrink-0 rounded-full border px-2 py-px text-[10px] font-semibold tracking-wide uppercase"
                    style={{ ['--tone' as string]: SEVERITY_COLOR[r.severity] }}
                  >
                    {r.severity}
                  </span>
                </div>
                <p className="text-muted mt-1 text-[12.5px] leading-relaxed text-pretty">{r.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PointList({
  label,
  icon,
  tone,
  items,
}: {
  label: string;
  icon: ReactNode;
  tone: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border p-3">
      <p
        className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase"
        style={{ color: tone }}
      >
        {icon}
        {label}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-muted flex gap-2 text-[12.5px] leading-relaxed text-pretty">
            <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: tone }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="surface-lit rounded-xl border p-2.5">
      <p
        className="numeric truncate text-[1.05rem] font-semibold"
        style={{
          background: `linear-gradient(135deg, var(--text-c) 15%, color-mix(in oklab, ${accent} 85%, var(--text-c)) 95%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
        title={value}
      >
        {value}
      </p>
      <p className="a-label mt-0.5 text-[9px]">{label}</p>
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

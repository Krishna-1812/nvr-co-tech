import Link from 'next/link';
import { ArrowRight, Layers, UploadCloud } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState, buttonClass } from '@/components/ui/primitives';
import { ToolHero } from '@/components/ui/ToolHero';
import { ArchScene } from '@/components/ui/Scene';
import { ComparablesTable } from '@/components/comps/ComparablesTable';
import { Verdict } from '@/components/comps/Verdict';
import { MethodBreakdown } from '@/components/comps/MethodBreakdown';
import { DetailTabs } from '@/components/comps/DetailTabs';
import { Rejected } from '@/components/comps/Rejected';
import { DeskControls } from '@/components/comps/DeskControls';
import { STATISTICS } from '@/lib/comps/statistics';
import { count, shortDate } from '@/lib/comps/format';
import { buildCompsView, type CompanyRow, type FinancialsRow, type QuoteRow } from '@/lib/comps/view';
import type { Statistic } from '@/lib/comps/types';

export const metadata = { title: 'Comparables' };

const COMPANY_COLUMNS =
  'id, name, listing_status, country, industry, business_description, nse_symbol, cin, nic_code';

/**
 * Comparable companies — the valuation, first.
 *
 * ── The screen leads with the answer now ──────────────────────────────────
 *
 * The pieces this page assembles are unchanged — the same pool query, the same
 * `buildCompsView`, the same table. What changed is the order they are read in.
 * The old desk opened on the eleven-column table and left "what the peers imply"
 * for the bottom of the page; a person came here to value a company and had to
 * scroll past the working to reach the number. So the number leads (`Verdict`),
 * the methods that produced it come next (`MethodBreakdown`), and the table, the
 * rejects and the provenance — the evidence — fold into one set of tabs below
 * (`DetailTabs`). The subject is chosen from a searchable box rather than a
 * thousand-row `<select>`, which is the other half of "easy to use".
 *
 * ── How the pool is chosen, and what will replace it ──────────────────────
 *
 * Candidates are companies sharing the subject's five-digit NIC code, capped.
 * That is a first pass and it is deliberately not the intended answer: an
 * industry code is too coarse to build a peer set from, which is the whole
 * argument for the embeddings in migration 0028 and for `find_peers`. But nothing
 * has been embedded yet, and a screen that waited for that would show nothing at
 * all — so the code narrows the pool, the screens narrow it further, and every
 * rejection is on screen with its reason.
 *
 * When embeddings land, this query becomes a `find_peers` call and the rest of the
 * page does not change.
 */
export default async function CompsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; stat?: string }>;
}) {
  const { subject: subjectId, stat } = await searchParams;
  const supabase = await createClient();

  const statistic: Statistic = STATISTICS.find((s) => s.value === stat)?.value ?? 'median';

  // The picker, and the default subject. Listed only: an unlisted company has no
  // market capitalisation, so it can be a peer but not yet a subject here.
  const { data: listed } = await supabase
    .from('companies')
    .select('id, name')
    .eq('listing_status', 'listed')
    .order('name');

  const choices = (listed ?? []) as { id: string; name: string }[];

  if (choices.length === 0) {
    /*
     * An empty registry gets the tool's own hero rather than a box with an owl
     * in it: it is the first thing a new desk ever shows, and it should look
     * like the tool it is about to become. The way out is "Seed the registry",
     * offered only to the people the rail offers it to — the same
     * `isAnalyticsAdmin()` the layout asks, memoised per request.
     */
    const canSeed = await isAnalyticsAdmin();
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Valuation Desk"
          title="Comparables"
          description="Value a company against its listed peers, then check the answer against the market."
        />
        <ToolHero
          id="comps-empty"
          as="h2"
          label="Comparable companies"
          pill={{ icon: Layers, text: 'Registry empty', tone: 'var(--status-draft)' }}
          title="There are no companies to compare yet"
          sub={
            canSeed
              ? 'Nothing has been ingested, so there are no peers to value against. Seed the registry from a free source and this screen fills itself in.'
              : 'Nothing has been ingested, so there are no peers to value against. A platform admin seeds the registry; once they have, this screen fills itself in.'
          }
          scene={<ArchScene motif="columns" className="h-full min-h-[18rem]" />}
        >
          {canSeed && (
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link
                href="/comps/ingest"
                className={buttonClass({ variant: 'primary', className: 'group' })}
              >
                <UploadCloud className="size-4" aria-hidden />
                Seed the registry
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          )}
        </ToolHero>
      </div>
    );
  }

  const chosen = choices.find((c) => c.id === subjectId) ?? choices[0];

  const header = (
    <PageHeader
      eyebrow="Valuation Desk"
      title="Comparables"
      description="Value a company against its listed peers, then check the answer against the market."
    />
  );

  const controls = (
    <DeskControls
      choices={choices}
      subjectId={chosen.id}
      subjectName={chosen.name}
      statistic={statistic}
    />
  );

  const { data: subjectRows } = await supabase
    .from('companies')
    .select(COMPANY_COLUMNS)
    .eq('id', chosen.id);

  const subjectCompany = ((subjectRows ?? [])[0] ?? null) as (CompanyRow & { nic_code: string | null }) | null;

  if (!subjectCompany) {
    return (
      <div className="space-y-6">
        {header}
        {controls}
        <Card>
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title="That company is no longer in the registry" description="Pick another from the box above." />
        </Card>
      </div>
    );
  }

  // The pool. `nic_code` where the subject has one; otherwise the whole industry
  // string, which is the only other thing every source supplies.
  const poolQuery = supabase.from('companies').select(COMPANY_COLUMNS).limit(120);
  const { data: poolRows } = subjectCompany.nic_code
    ? await poolQuery.eq('nic_code', subjectCompany.nic_code)
    : await poolQuery.eq('industry', subjectCompany.industry ?? '');

  const pool = (poolRows ?? []) as CompanyRow[];
  const ids = [...new Set([subjectCompany.id, ...pool.map((c) => c.id)])];

  const [{ data: finRows }, { data: quoteRows }] = await Promise.all([
    supabase.from('company_financials').select('*').in('company_id', ids),
    supabase.from('company_quotes').select('*').in('company_id', ids),
  ]);

  const financialsBy = new Map<string, FinancialsRow[]>();
  for (const row of (finRows ?? []) as FinancialsRow[]) {
    const list = financialsBy.get(row.company_id) ?? [];
    list.push(row);
    financialsBy.set(row.company_id, list);
  }

  const quotesBy = new Map<string, QuoteRow[]>();
  for (const row of (quoteRows ?? []) as QuoteRow[]) {
    const list = quotesBy.get(row.company_id) ?? [];
    list.push(row);
    quotesBy.set(row.company_id, list);
  }

  /*
   * The peer set date is the newest quote anywhere in the pool, not today.
   *
   * Today would silently pick up whatever the market last did between one page
   * load and the next, so the same link would render a slightly different
   * schedule each time it was opened — which for something a reviewer is asked
   * to sign is the wrong behaviour even when the drift is small.
   */
  const asOf =
    ((quoteRows ?? []) as QuoteRow[]).map((q) => q.as_of).sort().at(-1) ??
    new Date().toISOString().slice(0, 10);

  const view = buildCompsView({
    subjectCompany,
    subjectFinancials: financialsBy.get(subjectCompany.id) ?? [],
    subjectQuotes: quotesBy.get(subjectCompany.id) ?? [],
    pool: pool
      .filter((c) => c.id !== subjectCompany.id)
      .map((company) => ({
        company,
        financials: financialsBy.get(company.id) ?? [],
        quotes: quotesBy.get(company.id) ?? [],
      })),
    asOf,
    statistic,
  });

  if (!view) {
    return (
      <div className="space-y-6">
        {header}
        {controls}
        <Card>
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title={`No consolidated financials for ${subjectCompany.name}`}
            description="A subject needs its own figures before peers mean anything. Pick another company above, or ingest a filing for this one."
          />
        </Card>
      </div>
    );
  }

  const peerSetPane = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
        <p className="text-muted text-sm">
          <span className="font-semibold text-[var(--text-c)]">{view.subject.name}</span> against{' '}
          {count(view.comparables.length, 'peer')}, as at {shortDate(view.asOf)}. Open a company for
          its brief.
        </p>
        <p className="surface-sunken text-subtle rounded-full border px-2.5 py-1 text-[11.5px]">
          Screen: {view.screenNote}
        </p>
      </div>
      <ComparablesTable
        comparables={view.comparables}
        spreads={view.spreads}
        statistic={view.statistic}
      />
    </div>
  );

  const basisPane = (
    <div className="text-muted max-w-3xl space-y-3 px-5 py-5 text-[13px] leading-relaxed text-pretty sm:px-6">
      <p>
        Figures are {view.basis} and are the newest period each company has filed, which is not
        necessarily the same period for every company on the schedule — the date beside each row is
        the one its figures are for.
      </p>
      <p>
        {view.sources.length > 0 ? (
          <>Sources on this schedule: {view.sources.join(', ')}.</>
        ) : (
          <>No source is recorded against these figures, which should not happen.</>
        )}{' '}
        An empty cell means the figure is not in the registry. It does not mean zero.
      </p>
      <p>
        A multiple marked with an asterisk is outside the 1.5 × IQR fence. It has been kept in every
        statistic on this page: excluding a peer is a judgement, and this screen does not make it for
        you. Enterprise multiples imply the whole business, so this company&rsquo;s own debt and cash
        are taken off once to reach equity; P/E already implies equity and is not bridged again. No
        marketability or control discount has been applied.
      </p>
    </div>
  );

  const tabs = [
    { id: 'peers', label: 'Peer set', badge: view.comparables.length, content: peerSetPane },
    ...(view.rejected.length > 0
      ? [
          {
            id: 'excluded',
            label: 'Considered & excluded',
            badge: view.rejected.length,
            content: <Rejected rejected={view.rejected} />,
          },
        ]
      : []),
    { id: 'basis', label: 'Basis & sources', content: basisPane },
  ];

  return (
    <div className="space-y-6">
      {header}
      {controls}

      <Verdict
        conclusion={view.conclusion}
        subjectName={view.subject.name}
        industry={subjectCompany.industry}
        basis={view.basis}
        periodEnd={view.subject.periodEnd}
        asOf={view.asOf}
        peerCount={view.comparables.length}
        consideredCount={view.rejected.length}
        listingStatus={subjectCompany.listing_status}
        marketCap={view.subjectMarketCap}
        quoteAsOf={view.subjectQuoteAsOf}
      />

      <MethodBreakdown
        conclusion={view.conclusion}
        comparables={view.comparables}
        spreads={view.spreads}
      />

      <DetailTabs tabs={tabs} />
    </div>
  );
}

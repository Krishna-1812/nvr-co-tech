import { Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, EmptyState } from '@/components/ui/primitives';
import { ComparablesTable } from '@/components/comps/ComparablesTable';
import { Conclusion } from '@/components/comps/Conclusion';
import { Rejected } from '@/components/comps/Rejected';
import { SubjectBar, STATISTICS } from '@/components/comps/SubjectBar';
import { count, shortDate } from '@/lib/comps/format';
import { buildCompsView, type CompanyRow, type FinancialsRow, type QuoteRow } from '@/lib/comps/view';
import type { Statistic } from '@/lib/comps/types';

export const metadata = { title: 'Comparables' };

const COMPANY_COLUMNS =
  'id, name, listing_status, country, industry, business_description, nse_symbol, cin, nic_code';

/**
 * Comparable companies.
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
 * page does not change. The cap is here because the alternative on a real registry
 * is selecting three and a half million rows to render nine.
 *
 * ── Why the subject is a listed company ───────────────────────────────────
 *
 * Because then the market has already stated an answer, and the screen can check
 * itself against it. See the note in lib/comps/view.ts: that gap is the
 * ten-company hand check made continuous, and it is worth more on day one than a
 * form for typing an unlisted client's figures in.
 */
export default async function CompsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; stat?: string }>;
}) {
  const { subject: subjectId, stat } = await searchParams;
  const supabase = await createClient();

  const statistic: Statistic =
    STATISTICS.find((s) => s.value === stat)?.value ?? 'median';

  // The picker, and the default subject. Listed only: an unlisted company has no
  // market capitalisation, so it can be a peer but not yet a subject here.
  const { data: listed } = await supabase
    .from('companies')
    .select('id, name')
    .eq('listing_status', 'listed')
    .order('name');

  const choices = (listed ?? []) as { id: string; name: string }[];

  if (choices.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Valuation Desk"
          title="Comparables"
          description="Peer companies, the multiples they trade at, and what those imply."
        />
        <Card>
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title="The company registry is empty"
            description="Nothing has been ingested yet, so there are no peers to compare. Run an ingest pass against a source and this screen fills itself."
          />
        </Card>
      </>
    );
  }

  const chosen = choices.find((c) => c.id === subjectId) ?? choices[0];

  const { data: subjectRows } = await supabase
    .from('companies')
    .select(COMPANY_COLUMNS)
    .eq('id', chosen.id);

  const subjectCompany = ((subjectRows ?? [])[0] ?? null) as (CompanyRow & { nic_code: string | null }) | null;

  if (!subjectCompany) {
    return (
      <>
        <PageHeader eyebrow="Valuation Desk" title="Comparables" />
        <Card>
          <EmptyState title="That company is no longer in the registry" />
        </Card>
      </>
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
      <>
        <PageHeader eyebrow="Valuation Desk" title="Comparables" />
        <Card>
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title={`No consolidated financials for ${subjectCompany.name}`}
            description="A subject needs its own figures before peers mean anything. Pick another company, or ingest a filing for this one."
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Valuation Desk"
        title="Comparables"
        description={
          <>
            {view.subject.name} against {count(view.comparables.length, 'peer')}, as at{' '}
            {shortDate(view.asOf)}. {view.screenNote}.
          </>
        }
      />

      {/*
        The bar sits in the card it filters, not in the header's action slot.
        That slot is `shrink-0` and is for one primary control; three controls in
        it pushed the whole page 170px wider than a phone. See SubjectBar.
      */}
      <Card className="overflow-hidden">
        <SubjectBar choices={choices} subjectId={chosen.id} statistic={statistic} />
        <ComparablesTable
          comparables={view.comparables}
          spreads={view.spreads}
          statistic={view.statistic}
        />
      </Card>

      <Conclusion
        conclusion={view.conclusion}
        subjectName={view.subject.name}
        marketCap={view.subjectMarketCap}
        quoteAsOf={view.subjectQuoteAsOf}
      />

      <Rejected rejected={view.rejected} />

      <Card>
        <CardBody className="text-muted space-y-2 text-xs leading-relaxed">
          <p>
            Figures are {view.basis} and are the newest period each company has filed, which is not
            necessarily the same period for every company on the schedule — the date beside each row
            is the one its figures are for.
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
            A multiple marked with an asterisk is outside the 1.5 × IQR fence. It has been kept in
            every statistic on this page: excluding a peer is a judgement, and this screen does not
            make it for you.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

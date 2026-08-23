import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { PREVIEW } from '@/lib/preview';
import { BriefFailure, generateCompanyBrief, type CompanyContext } from '@/lib/comps/brief';
import { logServerError } from '@/lib/errors/server';

/**
 * One company's brief: the registry's own figures, read alongside one call to
 * Anthropic with web search.
 *
 * Cached in `company_briefs` — see that table's comment. This route decides
 * whether the cache still holds, not the client, because the client only ever
 * knows what it happened to load on the page; whether a brief is 30 days old
 * is a fact about the row, and belongs next to it.
 *
 * Signed in only, for the same reason /api/assist is: an unauthenticated route
 * that calls a paid API on this deployment's key is a bill waiting to be run
 * up by the first crawler that finds it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A brief older than this is offered again rather than trusted outright. */
const STALE_AFTER_DAYS = 30;

type Body = { companyId?: unknown; force?: unknown };

/**
 * A ceiling on how often one account can trigger a *generation*.
 *
 * Deliberately separate from the assistant's own limiter: reopening a company
 * that is already cached costs nothing and does not count here at all, so this
 * only ever throttles the one action that actually spends money — a cache
 * miss, or a deliberate refresh. In-memory and per-instance, same caveat as
 * assist/ratelimit.ts: a cost control, not a security control.
 */
const GENERATIONS_PER_WINDOW = 8;
const WINDOW_MS = 10 * 60 * 1000;
const seen = new Map<string, number[]>();

function rateLimited(userId: string, now = Date.now()): boolean {
  if (seen.size > 512) {
    for (const [key, hits] of seen) {
      if (hits.length === 0 || now - hits[hits.length - 1] > WINDOW_MS) seen.delete(key);
    }
  }
  const cutoff = now - WINDOW_MS;
  const hits = (seen.get(userId) ?? []).filter((t) => t > cutoff);
  if (hits.length >= GENERATIONS_PER_WINDOW) return true;
  hits.push(now);
  seen.set(userId, hits);
  return false;
}

type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  country: string;
  listing_status: string;
  industry: string | null;
  sector: string | null;
  business_description: string | null;
  cin: string | null;
  nse_symbol: string | null;
  bse_code: string | null;
  cik: string | null;
  isin: string | null;
};

type FinancialsRow = {
  period_end: string;
  basis: string;
  currency: string;
  revenue: number | null;
  ebitda: number | null;
  pat: number | null;
};

type QuoteRow = { as_of: string; market_cap: number | null; currency: string };

type BriefRow = {
  markdown: string;
  citations: unknown;
  model: string;
  generated_at: string;
};

function toContext(company: CompanyRow, financials: FinancialsRow | null, quote: QuoteRow | null): CompanyContext {
  return {
    name: company.name,
    legalName: company.legal_name,
    country: company.country,
    listingStatus: company.listing_status,
    industry: company.industry,
    sector: company.sector,
    businessDescription: company.business_description,
    identifiers: {
      CIN: company.cin ?? '',
      NSE: company.nse_symbol ?? '',
      BSE: company.bse_code ?? '',
      CIK: company.cik ?? '',
      ISIN: company.isin ?? '',
    },
    financials: financials
      ? {
          periodEnd: financials.period_end,
          basis: financials.basis,
          currency: financials.currency,
          revenue: financials.revenue,
          ebitda: financials.ebitda,
          pat: financials.pat,
        }
      : null,
    quote: quote?.market_cap != null ? { asOf: quote.as_of, marketCap: quote.market_cap, currency: quote.currency } : null,
  };
}

function isFresh(generatedAt: string): boolean {
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  return ageMs < STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

function citationsOf(raw: unknown): { title: string; url: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is { title: string; url: string } =>
      !!c && typeof c === 'object' && typeof (c as { url?: unknown }).url === 'string',
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });

  if (PREVIEW) {
    return NextResponse.json(
      { error: 'Company research is not available on sample data. Sign in to the real registry to use it.' },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const companyId = typeof body?.companyId === 'string' ? body.companyId : null;
  if (!companyId) return NextResponse.json({ error: 'No company was named.' }, { status: 400 });
  const force = body?.force === true;

  const supabase = await createClient();

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, legal_name, country, listing_status, industry, sector, business_description, cin, nse_symbol, bse_code, cik, isin')
    .eq('id', companyId)
    .maybeSingle<CompanyRow>();

  if (!company) return NextResponse.json({ error: 'That company is no longer in the registry.' }, { status: 404 });

  if (!force) {
    const { data: cached } = await supabase
      .from('company_briefs')
      .select('markdown, citations, model, generated_at')
      .eq('company_id', companyId)
      .maybeSingle<BriefRow>();

    if (cached && isFresh(cached.generated_at)) {
      return NextResponse.json({
        markdown: cached.markdown,
        citations: citationsOf(cached.citations),
        model: cached.model,
        generatedAt: cached.generated_at,
        cached: true,
      });
    }
  }

  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: 'That is a lot of company research in a short time. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const [{ data: financials }, { data: quote }] = await Promise.all([
    supabase
      .from('company_financials')
      .select('period_end, basis, currency, revenue, ebitda, pat')
      .eq('company_id', companyId)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle<FinancialsRow>(),
    supabase
      .from('company_quotes')
      .select('as_of, market_cap, currency')
      .eq('company_id', companyId)
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle<QuoteRow>(),
  ]);

  try {
    const brief = await generateCompanyBrief(toContext(company, financials, quote));

    // Cast for the same reason makeRpcWriter does in src/lib/comps/ingest/writers.ts:
    // this function's jsonb-payload shape is not in the generated Functions map.
    const { error: rpcError } = await supabase.rpc('record_company_brief' as Parameters<typeof supabase.rpc>[0], {
      p: {
        company_id: companyId,
        markdown: brief.markdown,
        citations: brief.citations,
        model: brief.model,
        input_tokens: brief.inputTokens,
        output_tokens: brief.outputTokens,
      },
    });
    // The reader still gets the brief they paid for even if the cache write
    // failed — it is simply regenerated next time, which costs money but never
    // shows as a broken screen.
    if (rpcError) {
      await logServerError({
        route: '/api/comps/brief',
        message: `record_company_brief: ${rpcError.message}`,
        stack: null,
        userEmail: user.authEmail ?? user.email ?? null,
      });
    }

    return NextResponse.json({
      markdown: brief.markdown,
      citations: brief.citations,
      model: brief.model,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    if (error instanceof BriefFailure) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    await logServerError({
      route: '/api/comps/brief',
      message: error instanceof Error ? error.message : 'Unknown error while researching a company',
      stack: error instanceof Error ? error.stack : null,
      userEmail: user.authEmail ?? user.email ?? null,
    });
    return NextResponse.json({ error: 'Something went wrong while researching that company.' }, { status: 500 });
  }
}

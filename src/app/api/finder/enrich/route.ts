import { NextResponse } from 'next/server';
import { rateLimited, requireApollo, TOO_MANY } from '@/lib/finder/gate';
import { enrichCompanyProfile, enrichPerson } from '@/lib/finder/enrich';
import { saveHistory } from '@/lib/finder/history';
import { newSpend, recordSpend } from '@/lib/finder/store';
import { logServerError } from '@/lib/errors/server';

/**
 * One person or one company, in full.
 *
 * This is the purchase. It is also the only action on this screen that
 * definitely costs something, and for a long time in the tool this is ported
 * from it was the one action that reported nothing: the button carried a static
 * "1 credit" label, which was wrong on a miss (free) and wrong on a cache hit
 * (also free). The number on the response is the number that was spent, and it
 * is the same variable the ledger is written from.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A company lookup is two calls: the profile, then the free leadership search. */
export const maxDuration = 45;

export async function POST(request: Request) {
  const gate = await requireApollo();
  if (!gate.ok) return gate.response;

  if (rateLimited('enrich', gate.userId)) return TOO_MANY;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = String(body?.type ?? '');
  if (kind !== 'person' && kind !== 'company') {
    return NextResponse.json({ error: 'Ask for a person or a company.' }, { status: 400 });
  }

  const text = (key: string) => String(body?.[key] ?? '').trim();
  const spend = newSpend();

  try {
    const profile =
      kind === 'person'
        ? await enrichPerson({
            supabase: gate.supabase,
            apiKey: gate.apiKey,
            name: text('name'),
            domain: text('domain'),
            apolloId: text('apollo_id'),
            email: text('email'),
            spend,
          })
        : await enrichCompanyProfile({
            apiKey: gate.apiKey,
            domain: text('domain'),
            apolloId: text('apollo_id'),
            spend,
          });

    /*
     * An enrichment is a purchase, and the contact details it returns are the
     * thing the credit bought. Recording it means a closed tab or a dismissed
     * panel does not lose what was paid for. Only a match is saved: a miss holds
     * nothing worth keeping and cost nothing to discover.
     */
    if (profile.matched) {
      const person = profile as Record<string, unknown>;
      const company = (person.company ?? null) as Record<string, unknown> | null;

      const label =
        [person.name ?? company?.name ?? '', person.title ?? company?.industry ?? '']
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join(' · ') ||
        text('name') ||
        text('domain') ||
        'Enriched contact';

      const domain = text('domain') || String(company?.domain ?? person.domain ?? '');

      /*
       * An Apollo id names the person; without one, the name and the employer
       * together do, and that is what the match was made on. Enriching the same
       * person twice then refreshes one entry rather than filling the drawer
       * with identical ones. Blank on both counts falls through to a plain
       * insert rather than colliding with the next nameless record.
       */
      const dedupe =
        String(person.apollo_id ?? text('apollo_id') ?? '').trim() ||
        [text('name').toLowerCase(), domain.toLowerCase()].filter(Boolean).join('|') ||
        undefined;

      await saveHistory(gate.supabase, {
        entity: kind === 'person' ? 'contact' : 'company_profile',
        label,
        rows: [profile],
        total: 1,
        credits: spend.credits,
        filters: { type: kind, domain, apollo_id: text('apollo_id') },
        dedupe,
      });
    }

    await recordSpend(gate.supabase, 'enrich', spend.credits);

    return NextResponse.json({
      profile,
      // Zero is a real answer here. A miss and a cache hit both cost nothing,
      // and saying so is the difference between a credit counter that can be
      // trusted and one that always says 1.
      credits: spend.credits,
    });
  } catch (error) {
    /*
     * Both helpers turn a failed Apollo call into an honest `lookup_failed`
     * answer, so anything landing here is a bug in this code rather than an
     * outage in theirs — but the credit may already be gone, so it is recorded
     * before the error is reported.
     */
    await recordSpend(gate.supabase, 'enrich', spend.credits);
    await logServerError({
      route: '/api/finder/enrich',
      message: error instanceof Error ? error.message : 'Unknown error enriching a record',
      stack: error instanceof Error ? error.stack : null,
      userEmail: gate.email,
    });
    return NextResponse.json(
      { error: 'Something went wrong looking that up.', credits: spend.credits },
      { status: 500 },
    );
  }
}

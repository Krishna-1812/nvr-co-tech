import { NextResponse } from 'next/server';
import { requireFinder } from '@/lib/finder/gate';
import { readLearnedIndustries, readLearnedVocab } from '@/lib/finder/store';
import { suggest as suggestIndustry } from '@/lib/finder/vocab/industries';
import { hint, isVocabKind, kinds, suggest as suggestCode } from '@/lib/finder/vocab/codes';
import type { PickerMeta } from '@/lib/finder/vocab/shared';

/**
 * What the pickers offer. Costs nothing, ever.
 *
 * One route for all five vocabularies rather than two, because one widget
 * renders them all and the entry shape is identical: a second endpoint would be
 * a second place for that shape to drift.
 *
 * Every list is the seeded vocabulary merged with what Apollo has actually been
 * seen to return, and each row says which it is. A seeded value nobody has ever
 * seen returned is a guess this codebase made; a value Apollo really uses is
 * not, and the difference is worth showing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? 'industry';
  const query = (url.searchParams.get('q') ?? '').slice(0, 60);

  const meta: Partial<PickerMeta> = {};

  if (kind === 'industry') {
    const learned = await readLearnedIndustries(gate.supabase);
    const entries = suggestIndustry(query, { learned, meta });
    return NextResponse.json({ kind, query, entries, ...meta, hint: '' });
  }

  if (!isVocabKind(kind)) {
    return NextResponse.json(
      { error: 'unknown vocabulary', kinds: ['industry', ...kinds()] },
      { status: 400 },
    );
  }

  /*
   * NAICS and SIC are seed-only, and that is a property of the plan rather than
   * an omission: the free people search does not return those fields, so there
   * is nothing to learn from.
   */
  const learned =
    kind === 'technology' || kind === 'location'
      ? await readLearnedVocab(gate.supabase, kind)
      : [];

  const entries = suggestCode(kind, query, { learned, meta });
  return NextResponse.json({ kind, query, entries, ...meta, hint: hint(kind) });
}

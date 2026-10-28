import { publishedGuides } from '@/lib/guides';
import Image from '../opengraph-image';

/**
 * The guide's share card at a plain address (seo.ts `cardPath`), for the
 * `image` its Article data names. The same picture the opengraph-image route
 * serves, which lives at a hashed path structured data cannot name. Published
 * guides only: a draft is described nowhere a crawler reads.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedGuides().map((g) => ({ slug: g.slug }));
}

export function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  return Image(ctx);
}

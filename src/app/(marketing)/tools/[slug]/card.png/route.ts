import { LIVE_AGENTS } from '@/lib/marketing/content';
import Image from '../opengraph-image';

/**
 * The tool's share card at a plain address (seo.ts `cardPath`), for the
 * `image` its WebApplication data names; see the guides' card.png.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return LIVE_AGENTS.map((a) => ({ slug: a.slug }));
}

export function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  return Image(ctx);
}

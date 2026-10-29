import { absolute } from '@/lib/marketing/seo';
import { markdownFor, markdownPages } from '@/lib/marketing/markdown';

/**
 * The Markdown copy of a public page (lib/marketing/markdown.ts).
 *
 * Reached through next.config's rewrites, never linked to directly: as
 * `/guides/x.md`, or as `/guides/x` asked for with `Accept: text/markdown`.
 * The home page is `/index.md`. robots.txt keeps crawlers out of `/md/` itself,
 * and the `Link` header names the page as the canonical, so a copy found by a
 * crawler is folded into the page rather than indexed beside it.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

const toPath = (segments: string[]) => (segments.join('/') === 'index' ? '/' : `/${segments.join('/')}`);

export function generateStaticParams() {
  return markdownPages().map((p) => ({ path: p === '/' ? ['index'] : p.slice(1).split('/') }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const path = toPath((await params).path);
  const body = markdownFor(path);
  if (body === null) return new Response('Not found\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      link: `<${absolute(path)}>; rel="canonical"`,
      // The same address can answer with the page or with this, by the Accept
      // header; a shared cache has to keep the two apart.
      vary: 'Accept',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

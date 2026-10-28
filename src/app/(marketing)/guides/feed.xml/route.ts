import { BRAND, CONTACT, agentBySlug } from '@/lib/marketing/content';
import { absolute } from '@/lib/marketing/seo';
import { publishedGuides } from '@/lib/guides';

/**
 * /guides/feed.xml: the published guides as an RSS feed, newest first.
 *
 * For feed readers, and for the crawlers that discover new pages from feeds
 * faster than from a sitemap they revisit when they choose. Each item carries
 * the guide's short answer, the same words the page opens with. Linked from
 * every public page's head (seo.ts `pageMeta`).
 */
export const dynamic = 'force-static';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rfc822 = (iso: string) => new Date(`${iso}T00:00:00Z`).toUTCString();

export function GET(): Response {
  const guides = publishedGuides()
    .map((g) => ({ g, first: g.published ?? g.updated }))
    .sort((a, b) => b.first.localeCompare(a.first) || a.g.title.localeCompare(b.g.title));
  const newest = guides.map(({ g }) => g.updated).sort().at(-1);

  const items = guides.map(({ g, first }) => {
    const url = absolute(`/guides/${g.slug}`);
    const topic = agentBySlug(g.tool)?.category;
    return [
      '    <item>',
      `      <title>${escape(g.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${rfc822(first)}</pubDate>`,
      ...(topic ? [`      <category>${escape(topic)}</category>`] : []),
      `      <description>${escape(g.answer)}</description>`,
      '    </item>',
    ].join('\n');
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escape(`${BRAND.name}: guides`)}</title>`,
    `    <link>${absolute('/guides')}</link>`,
    `    <atom:link href="${absolute('/guides/feed.xml')}" rel="self" type="application/rss+xml" />`,
    `    <description>${escape('Plain answers to finance questions in India, each worked through with an example.')}</description>`,
    '    <language>en-IN</language>',
    `    <managingEditor>${CONTACT.email} (${escape(BRAND.name)})</managingEditor>`,
    ...(newest ? [`    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`] : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}

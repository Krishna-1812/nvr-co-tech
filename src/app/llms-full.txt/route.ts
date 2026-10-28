import { AGENTS, BRAND, CONTACT, HOME_FAQ, STAGE_LABEL, type Agent } from '@/lib/marketing/content';
import { absolute } from '@/lib/marketing/seo';
import { blockText, publishedGuides, type Guide } from '@/lib/guides';

/**
 * /llms-full.txt: everything /llms.txt links to, in one file.
 *
 * /llms.txt is the index, a line a tool. An assistant asked "is there a tool
 * that reconciles a bank statement in the browser" would otherwise have to fetch
 * a dozen pages to find out, and most will fetch one. This is each tool's page
 * with the presentation taken off: what it does, what goes in and comes out, and
 * the questions on its page, word for word.
 *
 * Built from content.ts like /llms.txt and for the same reason, and every tool
 * that is not built says so on its own heading, so nothing here can be read as
 * an offer of something that does not exist.
 */
export const dynamic = 'force-static';

function section(a: Agent): string[] {
  const out = [
    `## ${a.name} (${STAGE_LABEL[a.stage]})`,
    '',
    `${absolute(`/tools/${a.slug}`)}`,
    '',
    a.summary,
    '',
    a.pitch,
    '',
    a.stage === 'live' ? 'What it does:' : 'What it is planned to do (not built yet):',
    '',
    ...a.does.map((d) => `- ${d}`),
    '',
    `Goes in: ${a.inputs}`,
    `Comes out: ${a.outputs}`,
  ];
  if (a.faq && a.faq.length > 0) {
    out.push('', 'Questions:', '');
    for (const f of a.faq) out.push(`Q: ${f.q}`, `A: ${f.a}`, '');
  }
  out.push('');
  return out;
}

/** A published guide as plain text: the answer, every section, its questions. */
function guideSection(g: Guide): string[] {
  const out = [`## ${g.title}`, '', absolute(`/guides/${g.slug}`), '', g.answer, ''];
  for (const b of g.blocks) {
    if (b.t === 'h2') out.push(`### ${b.text}`, '');
    else if (b.t === 'ul' || b.t === 'ol') out.push(...b.items.map((i) => `- ${i}`), '');
    else if (b.t === 'table') out.push(`${b.caption}:`, ...b.rows.map((r) => `- ${r.filter(Boolean).join(': ')}`), '');
    else out.push(...blockText(b), '');
  }
  out.push('Questions:', '');
  for (const f of g.faq) out.push(`Q: ${f.q}`, `A: ${f.a}`, '');
  return out;
}

export function GET(): Response {
  const live = AGENTS.filter((a) => a.stage === 'live');
  const coming = AGENTS.filter((a) => a.stage !== 'live');

  const body = [
    `# ${BRAND.name}: every tool in full`,
    '',
    `> ${BRAND.blurb}`,
    '',
    `The short index is ${absolute('/llms.txt')}. Contact: ${CONTACT.email}.`,
    '',
    // The home page's questions, in the same words the page and its FAQ data use.
    '# Questions',
    '',
    ...HOME_FAQ.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`, '']),
    '# Live today',
    '',
    ...live.flatMap(section),
    ...(coming.length > 0 ? ['# Not built yet', '', ...coming.flatMap(section)] : []),
    ...(publishedGuides().length > 0 ? ['# Guides', '', ...publishedGuides().flatMap(guideSection)] : []),
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

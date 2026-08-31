import { AGENTS, BRAND, CONTACT, STAGE_LABEL } from '@/lib/marketing/content';
import { absolute } from '@/lib/marketing/seo';

/**
 * /llms.txt — the site, written for something that is going to read it rather
 * than look at it.
 *
 * robots.txt says where a crawler may not go and sitemap.xml says which URLs
 * exist. Neither says what any of them are for, so an assistant asked "what
 * does The Finance Intelligence do" gets to work it out from a marketing page
 * built out of animation wrappers and scroll reveals. This is the same
 * information with the presentation taken off.
 *
 * ── Why it is generated rather than written ─────────────────────────────────
 *
 * A hand-written file describing a roster that changes is a file that will one
 * day describe the roster as it was. This one is built from `content.ts`, the
 * same source the pages render from, so an agent going live changes its line
 * here in the same commit.
 *
 * The stage of every agent is stated plainly, and that is the point rather than
 * a detail: six of the eight are not built. An assistant that reads this and
 * tells somebody they can go and use Audit Copilot today has been misled by us,
 * and the fix is to say so here rather than to hope it infers the difference.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const live = AGENTS.filter((a) => a.stage === 'live');
  const coming = AGENTS.filter((a) => a.stage !== 'live');

  const line = (a: (typeof AGENTS)[number]) =>
    `- [${a.name}](${absolute(`/agents/${a.slug}`)}): ${STAGE_LABEL[a.stage]}. ${a.summary}`;

  const body = [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.blurb}`,
    '',
    `${BRAND.name} builds one tool for each job an Indian finance team repeats every month.`,
    'Each one does the mechanical part of the work and then puts the decision in front of a',
    'person. The rules the tools enforce are held in the database rather than in the screens,',
    'so they apply however the request arrives.',
    '',
    'Some of the tools are live today. The rest are being built or are written up and waiting',
    'their turn, and every page on the site says which is which — as do the two lists below.',
    '',
    '## Live today',
    '',
    ...live.map(line),
    '',
    '## Not built yet',
    '',
    ...coming.map(line),
    '',
    '## The site',
    '',
    `- [Home](${absolute('/')}): what the platform is and who it is for.`,
    `- [Agents](${absolute('/agents')}): the whole roster, grouped by what is built and what is not.`,
    `- [About](${absolute('/about')}): who is building this, and the four rules it is built to.`,
    `- [Book a walkthrough](${absolute('/contact')}): half an hour with the people who built it.`,
    '',
    '## Terms and privacy',
    '',
    `- [Privacy](${absolute('/privacy')}): what is collected. The measurement is our own, there is no`,
    '  third-party analytics or advertising pixel, and files you reconcile are parsed in your',
    '  browser and never uploaded.',
    `- [Terms](${absolute('/terms')}): the terms that apply to using the platform.`,
    '',
    '## Contact',
    '',
    `- ${CONTACT.email}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Long enough that it is not refetched on every question, short enough
      // that an agent going live reaches a reader the same day it deploys.
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

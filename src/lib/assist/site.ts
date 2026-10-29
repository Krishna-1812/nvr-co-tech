import { AGENTS, BRAND, CONTACT, HOME_FAQ, STAGE_LABEL, WALKTHROUGH_STEPS } from '@/lib/marketing/content';
import { PRIVACY_CLAUSES, PRIVACY_UPDATED, TERMS_CLAUSES, TERMS_UPDATED, type Clause } from '@/lib/marketing/legal';
import { blockText, publishedGuides, type Guide } from '@/lib/guides';
import { glossary } from '@/lib/guides/glossary';
import { CALCULATORS } from '@/lib/calculators';
import { OPEN_TOOLS } from '@/lib/access';
import { DOCS, type Doc } from './knowledge';
import { createIndex } from './retrieve';

/**
 * Everything the website says, as documents.
 *
 * The assistant's own corpus (knowledge.ts) describes the tools and the work.
 * A visitor asks about the website as well: what is this, what does it cost,
 * where is the privacy policy, how do I sign up, is there a guide on rental
 * yield. Those answers are already written, on the pages, and this file turns
 * the pages' own words into documents rather than writing them a second time.
 * The FAQ, the policies, the walkthrough steps and the guides are all read from
 * the constants their pages render, so the chat and the page cannot disagree.
 *
 * Only what is public is here. A draft guide or a tool that is not on the
 * roster never reaches this list, by the same filters the pages use.
 */

/** "A, B and C". */
function listOf(names: readonly string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function clauses(list: Clause[]): string[] {
  return list.flatMap((c) => [`${c.title}.`, ...(Array.isArray(c.body) ? c.body : [c.body]), '']);
}

/** One published guide, its answer, every section and its questions. */
function guideDoc(g: Guide): Doc {
  const lines: string[] = [g.lead, '', `The short answer: ${g.answer}`, ''];
  for (const b of g.blocks) {
    if (b.t === 'h2') lines.push(`${b.text}:`);
    else if (b.t === 'ul' || b.t === 'ol') lines.push(...b.items.map((i) => `- ${i}`), '');
    else if (b.t === 'table') lines.push(`${b.caption}:`, ...b.rows.map((r) => `- ${r.filter(Boolean).join(': ')}`), '');
    else lines.push(...blockText(b), '');
  }
  lines.push('Questions on the guide:', ...g.faq.map((f) => `- ${f.q} ${f.a}`));
  const tool = AGENTS.find((a) => a.slug === g.tool);
  if (tool) lines.push('', `The tool this guide leads to: ${tool.name}, at /tools/${tool.slug}.`);

  return {
    id: `guide-${g.slug}`,
    title: `Guide: ${g.title}`,
    agent: g.tool,
    kind: 'finance',
    href: `/guides/${g.slug}`,
    keywords: ['guide', 'how to', 'explained', 'example', g.short],
    body: lines.join('\n'),
  };
}

function publicDocs(): Doc[] {
  const guides = publishedGuides();
  const open = AGENTS.filter((a) => OPEN_TOOLS.includes(a.slug));

  return [
    {
      id: 'site-faq',
      title: 'Questions people ask first',
      agent: null,
      kind: 'platform',
      href: '/',
      keywords: ['faq', 'free', 'cost', 'price', 'account', 'advice', 'safe', 'who', 'what is'],
      body: HOME_FAQ.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`, '']).join('\n'),
    },
    {
      id: 'site-about',
      title: 'About the team',
      agent: null,
      kind: 'platform',
      href: '/about',
      keywords: ['about', 'company', 'team', 'founders', 'chartered accountants', 'who built', 'why'],
      body: [
        `${BRAND.name} is built by chartered accountants. Everything here started out as`,
        'work they were doing by hand, for clients, against deadlines. The tools exist',
        'because the people doing that work wrote out which parts of it never really',
        'needed a person.',
        '',
        'Their argument, from the About page: a practice knows which parts of the work',
        'are rules and which are judgement. The TDS section on a payment is a rule; the',
        'decision to pay early is a judgement. Automating a rule is normal engineering;',
        'knowing exactly where the rules stop, and not guessing past that point, is the',
        'part you only get from having done the job.',
        '',
        'They also keep the rules in the database rather than in the website. Who can',
        'read a voucher, who can approve it, and what is locked are decided by the',
        'database itself, so nobody can approve their own voucher even with a valid',
        'login and no website at all. A voucher has 32 fields, takes one signature to',
        'approve (never from the person who raised it), and its history cannot be',
        'edited by any role.',
        '',
        `To write to the team: ${CONTACT.email}.`,
      ].join('\n'),
    },
    {
      id: 'site-contact',
      title: 'Contact and walkthroughs',
      agent: null,
      kind: 'platform',
      href: '/contact',
      keywords: ['contact', 'email', 'demo', 'walkthrough', 'call', 'talk', 'sales', 'support', 'help', 'reach'],
      body: [
        'The contact page, at /contact, books a walkthrough: half an hour with the people',
        'who built it, using the tool that is actually running. You say which tool',
        'interests you and what your month currently looks like.',
        '',
        'What happens after you send it:',
        ...WALKTHROUGH_STEPS.map((s) => `- ${s.t}. ${s.d}`),
        '',
        `Or write directly to ${CONTACT.email}. A person reads it.`,
        '',
        'To use one of the tools kept for our own team, open its page under /tools and',
        'request access there; a person reads every request and replies.',
      ].join('\n'),
    },
    {
      id: 'site-account',
      title: 'Signing up and signing in',
      agent: null,
      kind: 'platform',
      href: '/signup',
      keywords: ['sign up', 'signup', 'register', 'login', 'log in', 'sign in', 'password', 'google', 'account', 'forgot'],
      body: [
        'Create an account at /signup and sign in at /login, with Google or with an email',
        'address and a password. A forgotten password is reset from /forgot-password.',
        '',
        `No account is needed to look round the workspace at /hub, or to use ${listOf(open.map((a) => a.name))}.`,
        'Signing in does not open more tools. It saves your work in those tools to your',
        'account, so it is not lost with the browser and is there on your other devices.',
        'Your name, email, password and theme are changed at /settings once you are in.',
      ].join('\n'),
    },
    {
      id: 'site-pages',
      title: 'Every page on the site',
      agent: null,
      kind: 'platform',
      keywords: ['page', 'link', 'where', 'url', 'menu', 'website', 'site', 'find'],
      body: [
        '- / is the home page: what the platform is, the finance month and the questions people ask.',
        '- /tools lists every tool. Each has its own page:',
        ...AGENTS.map((a) => `  - ${a.name} (${STAGE_LABEL[a.stage].toLowerCase()}): /tools/${a.slug}`),
        ...(guides.length
          ? [
              '- /guides lists the guides. Each answers one question in full, with a worked example:',
              ...guides.map((g) => `  - ${g.title}: /guides/${g.slug}`),
              '- /glossary defines every finance term the guides and tools use, each linked to its guide.',
              '- /guides/feed.xml is the guides as an RSS feed.',
            ]
          : []),
        '- /calculators lists the free calculators. Each works out one sum on your own figures, with no account:',
        ...CALCULATORS.map((c) => `  - ${c.name}: /calculators/${c.slug}`),
        '- /about is who built it and why.',
        '- /contact books a walkthrough.',
        `- /privacy is the privacy policy (updated ${PRIVACY_UPDATED}) and /terms the terms of use (updated ${TERMS_UPDATED}).`,
        '- /login, /signup and /forgot-password are for accounts.',
        '- /hub is the workspace, where every tool opens. It is open without an account.',
        ...open.map((a) => `- ${a.href} opens ${a.name} itself.`),
        '- /llms.txt and /llms-full.txt describe the site for AI assistants.',
      ].join('\n'),
    },
    ...(guides.length
      ? [
          {
            id: 'site-guides',
            title: 'The guides',
            agent: null,
            kind: 'finance' as const,
            href: '/guides',
            keywords: ['guide', 'guides', 'article', 'learn', 'read', 'explain', 'how to'],
            body: [
              'Guides answer one question each, in full, with a worked example, and then',
              'point at the tool that does the work. They are general information, not advice.',
              '',
              ...guides.map((g) => `- ${g.title} (/guides/${g.slug}): ${g.answer}`),
            ].join('\n'),
          },
        ]
      : []),
    ...guides.map(guideDoc),
    {
      id: 'site-calculators',
      title: 'Free calculators',
      agent: null,
      kind: 'finance' as const,
      href: '/calculators',
      keywords: ['calculator', 'calculate', 'work out', 'compute', 'how much', 'rental yield', 'emi', 'gst', 'loading', 'ev/ebitda'],
      body: [
        'Free calculators, no account needed. Each opens on a worked example and links to the guide that explains it.',
        '',
        ...CALCULATORS.flatMap((c) => [`- ${c.name} (/calculators/${c.slug}): ${c.answer}`, ...c.formulas.map((f) => `  ${f}`)]),
      ].join('\n'),
    },
    ...(guides.length
      ? [
          {
            id: 'site-glossary',
            title: 'Glossary',
            agent: null,
            kind: 'finance' as const,
            href: '/glossary',
            keywords: ['glossary', 'meaning', 'definition', 'define', 'what is', 'term', 'means'],
            body: glossary()
              .map((t) => `- ${t.term}: ${t.definition}${t.href ? ` (${t.href})` : ''}`)
              .join('\n'),
          },
        ]
      : []),
    {
      id: 'site-privacy-policy',
      title: 'Privacy policy',
      agent: null,
      kind: 'platform',
      href: '/privacy',
      keywords: ['privacy', 'policy', 'cookies', 'personal data', 'delete', 'retention', 'dpdp', 'tracking'],
      body: [`Last updated ${PRIVACY_UPDATED}.`, '', ...clauses(PRIVACY_CLAUSES)].join('\n'),
    },
    {
      id: 'site-terms',
      title: 'Terms of use',
      agent: null,
      kind: 'platform',
      href: '/terms',
      keywords: ['terms', 'conditions', 'liability', 'warranty', 'legal', 'agreement', 'license'],
      body: [`Last updated ${TERMS_UPDATED}.`, '', ...clauses(TERMS_CLAUSES)].join('\n'),
    },
  ];
}

/** The public pages' documents. */
export const PUBLIC_DOCS: Doc[] = publicDocs();

/** Everything there is to know about the website, the tools and the work. */
export const SITE_DOCS: Doc[] = [...DOCS, ...PUBLIC_DOCS];

/** Retrieval over all of it, for the documents shown under an answer. */
export const SITE_INDEX = createIndex(SITE_DOCS);

/**
 * The whole corpus as one block of text.
 *
 * The public chat is given all of it on every question, not a retrieved few.
 * At about twenty-five thousand tokens it fits easily, it never changes within
 * a deployment, so it is sent with a cache marker and read back at a tenth of
 * the price, and it removes the one failure retrieval has: a question worded so
 * that the right document is not found, answered "I do not know" when the
 * website says it plainly.
 */
export function corpusText(docs: Doc[]): string {
  return docs
    .map((doc, i) => {
      const agent = doc.agent ? AGENTS.find((a) => a.slug === doc.agent) : undefined;
      const heading = agent && !doc.title.includes(agent.name) ? `${doc.title} (${agent.name})` : doc.title;
      const page = doc.href ? `\nPage: ${doc.href}` : '';
      return `--- Document ${i + 1}: ${heading} ---${page}\n${doc.body}`;
    })
    .join('\n\n');
}

export const SITE_CORPUS = corpusText(SITE_DOCS);

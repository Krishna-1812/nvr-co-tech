import { AGENTS, BRAND, CONTACT, HOME_FAQ, STAGE_LABEL, agentBySlug, toolFaq, type Agent } from './content';
import { absolute } from './seo';
import { guideBySlug, publishedGuides, type Guide } from '@/lib/guides';
import { TOPICS, glossary } from '@/lib/guides/glossary';
import { CALCULATORS, calculatorBySlug, workedExample, type Calculator } from '@/lib/calculators';
import { FIELDS, shownValue } from '@/lib/calculators/fields';

/**
 * The public pages as Markdown, for software that reads rather than looks.
 *
 * An assistant fetching a page to answer a question (ChatGPT, Claude,
 * Perplexity and the coding agents all do this on demand) gets a page of
 * animation wrappers, scripts and duplicated payload, and has to dig the words
 * out. Asking for `/guides/x.md`, or for `/guides/x` with `Accept:
 * text/markdown`, gets the same words with the presentation taken off
 * (next.config rewrites to app/md). Each page announces its copy with
 * `<link rel="alternate" type="text/markdown">` (seo.ts pageMeta).
 *
 * Built from the same constants the pages render, like /llms.txt, so the two
 * cannot drift. Published guides only, as everywhere else that is read by
 * machines. Every document ends with the page it is a copy of, which is also
 * the canonical (a `Link` header on the response), so a search engine that
 * finds one indexes the page rather than the copy.
 */

const link = (text: string, path: string) => `[${text}](${absolute(path)})`;

function footer(path: string, updated?: string): string[] {
  return ['---', '', `Source: ${absolute(path)}${updated ? ` (updated ${updated})` : ''}`, `${BRAND.definition} Contact: ${CONTACT.email}.`, ''];
}

/** A Markdown table, with the pipes in cells escaped. */
function table(head: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  return [
    `| ${head.map((h) => cell(h || ' ')).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ];
}

const faqLines = (faq: readonly { q: string; a: string }[]) => faq.flatMap((f) => [`### ${f.q}`, '', f.a, '']);

function home(): string {
  const live = AGENTS.filter((a) => a.stage === 'live');
  const guides = publishedGuides();
  return [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.blurb}`,
    '',
    BRAND.definition,
    '',
    '## Tools',
    '',
    ...live.map((a) => `- ${link(a.name, `/tools/${a.slug}`)}: ${a.summary}`),
    '',
    '## Free calculators',
    '',
    ...CALCULATORS.map((c) => `- ${link(c.name, `/calculators/${c.slug}`)}: ${c.lead}`),
    '',
    ...(guides.length ? ['## Guides', '', ...guides.map((g) => `- ${link(g.title, `/guides/${g.slug}`)}: ${g.answer}`), ''] : []),
    '## Questions',
    '',
    ...faqLines(HOME_FAQ),
    ...footer('/'),
  ].join('\n');
}

function toolsIndex(): string {
  return [
    `# Tools from ${BRAND.name}`,
    '',
    'Each tool takes a routine part of finance work off your desk, does the repetitive part, and leaves the decision with you.',
    '',
    ...AGENTS.map((a) => `- ${link(a.name, `/tools/${a.slug}`)} (${STAGE_LABEL[a.stage]}): ${a.summary}`),
    '',
    ...footer('/tools'),
  ].join('\n');
}

function tool(a: Agent): string {
  const faq = toolFaq(a);
  return [
    `# ${a.name}`,
    '',
    `${a.category} · ${STAGE_LABEL[a.stage]}`,
    '',
    ...(a.definition ? [a.definition, ''] : []),
    a.summary,
    '',
    a.pitch,
    '',
    a.stage === 'live' ? '## What it does' : '## What it is planned to do (not built yet)',
    '',
    ...a.does.map((d) => `- ${d}`),
    '',
    `- **Goes in:** ${a.inputs}`,
    `- **Comes out:** ${a.outputs}`,
    '',
    ...(a.href && a.stage === 'live' ? [`Open it: ${absolute(a.href)}`, ''] : []),
    ...(faq.length ? ['## Questions', '', ...faqLines(faq)] : []),
    ...footer(`/tools/${a.slug}`),
  ].join('\n');
}

function guidesIndex(): string {
  return [
    '# Finance guides for India',
    '',
    'Each guide answers one question people search for, in plain words, with a worked example in rupees.',
    '',
    ...publishedGuides().map((g) => `- ${link(g.title, `/guides/${g.slug}`)}: ${g.answer}`),
    '',
    `Every term they use is defined in the ${link('glossary', '/glossary')}.`,
    '',
    ...footer('/guides'),
  ].join('\n');
}

function guide(g: Guide): string {
  const tool = agentBySlug(g.tool);
  const calculator = CALCULATORS.find((c) => c.guide === g.slug);
  const out = [`# ${g.title}`, '', g.lead, '', '## The short answer', '', g.answer, ''];
  for (const b of g.blocks) {
    if (b.t === 'h2') out.push(`## ${b.text}`, '');
    else if (b.t === 'p') out.push(b.text, '');
    else if (b.t === 'formula') out.push(`> ${b.text}`, '');
    else if (b.t === 'ul') out.push(...b.items.map((i) => `- ${i}`), '');
    else if (b.t === 'ol') out.push(...b.items.map((i, n) => `${n + 1}. ${i}`), '');
    else if (b.t === 'table') out.push(`**${b.caption}**`, '', ...table(b.head, b.rows), '');
    else if (b.t === 'note') out.push(`> **${b.title}.** ${b.text}`, '');
  }
  if (calculator) out.push(`Work it out on your own figures: ${link(calculator.name, `/calculators/${calculator.slug}`)}.`, '');
  out.push('## Questions', '', ...faqLines(g.faq));
  if (g.sources?.length) out.push('## Sources', '', ...g.sources.map((s) => `- [${s.name}](${s.url}), ${s.publisher}`), '');
  if (tool) out.push(`The tool this guide leads to: ${link(tool.name, `/tools/${tool.slug}`)}.`, '');
  out.push(...footer(`/guides/${g.slug}`, g.updated));
  return out.join('\n');
}

function calculatorsIndex(): string {
  return [
    '# Free finance calculators for India',
    '',
    'Each calculator works out one sum on your own figures, opens on a worked example, shows its formulas and links to the guide that explains it. No sign-up.',
    '',
    ...CALCULATORS.map((c) => `- ${link(c.name, `/calculators/${c.slug}`)}: ${c.answer}`),
    '',
    ...footer('/calculators'),
  ].join('\n');
}

function calculator(c: Calculator): string {
  const g = guideBySlug(c.guide);
  const t = agentBySlug(c.tool);
  const example = workedExample(c);
  const terms = glossary().filter((term) => c.terms.includes(term.id));
  return [
    `# ${c.name}`,
    '',
    c.lead,
    '',
    `Use it free, with no account: ${absolute(`/calculators/${c.slug}`)}`,
    '',
    '## The short answer',
    '',
    c.answer,
    '',
    '## How it is worked out',
    '',
    ...c.formulas.map((f) => `- ${f}`),
    '',
    ...c.blocks.flatMap((b) => (b.t === 'p' ? [b.text, ''] : b.t === 'note' ? [`> **${b.title}.** ${b.text}`, ''] : [])),
    '## A worked example',
    '',
    ...table(
      ['', 'Figure'],
      [
        ...FIELDS[c.kind].map((f) => [f.label, shownValue(f)]),
        ...example.lines.map((l) => [l.strong ? `**${l.label}**` : l.label, l.strong ? `**${l.value}**` : l.value]),
      ],
    ),
    '',
    ...(example.note ? [example.note, ''] : []),
    ...(terms.length ? ['## The terms it uses', '', ...terms.map((term) => `- **${term.term}**: ${term.definition}`), ''] : []),
    '## Questions',
    '',
    ...faqLines(c.faq),
    ...(g ? [`The guide behind it: ${link(g.title, `/guides/${g.slug}`)}.`, ''] : []),
    ...(t ? [`For the whole picture: ${link(t.name, `/tools/${t.slug}`)}.`, ''] : []),
    ...footer(`/calculators/${c.slug}`, c.updated),
  ].join('\n');
}

function glossaryDoc(): string {
  const terms = glossary();
  return [
    '# Finance glossary',
    '',
    'Plain definitions of the finance terms the guides and tools use, each linked to the guide that works it through.',
    '',
    ...TOPICS.flatMap((topic) => [
      `## ${topic}`,
      '',
      ...terms
        .filter((t) => t.topic === topic)
        .map((t) => `- **${t.term}**: ${t.definition}${t.href ? ` (${link('guide', t.href)})` : ''}`),
      '',
    ]),
    ...footer('/glossary'),
  ].join('\n');
}

/** Every page there is a Markdown copy of, by its path on the site. */
export function markdownPages(): string[] {
  const guides = publishedGuides();
  return [
    '/',
    '/tools',
    ...AGENTS.map((a) => `/tools/${a.slug}`),
    '/calculators',
    ...CALCULATORS.map((c) => `/calculators/${c.slug}`),
    ...(guides.length ? ['/guides', ...guides.map((g) => `/guides/${g.slug}`), '/glossary'] : []),
  ];
}

/** The Markdown copy of a page, or null where there is none. */
export function markdownFor(path: string): string | null {
  if (!markdownPages().includes(path)) return null;
  if (path === '/') return home();
  if (path === '/tools') return toolsIndex();
  if (path === '/guides') return guidesIndex();
  if (path === '/calculators') return calculatorsIndex();
  if (path === '/glossary') return glossaryDoc();
  const [, kind, slug] = path.split('/');
  if (kind === 'tools') {
    const a = agentBySlug(slug);
    return a ? tool(a) : null;
  }
  if (kind === 'guides') {
    const g = guideBySlug(slug);
    return g && g.status === 'published' ? guide(g) : null;
  }
  if (kind === 'calculators') {
    const c = calculatorBySlug(slug);
    return c ? calculator(c) : null;
  }
  return null;
}

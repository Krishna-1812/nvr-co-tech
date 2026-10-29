import type { MetadataRoute } from 'next';
import { AGENTS, CANONICAL_URL, NAV } from '@/lib/marketing/content';
import { publishedGuides } from '@/lib/guides';
import { CALCULATORS } from '@/lib/calculators';

/**
 * Only the public pages. The signed-in routes are deliberately absent — they
 * redirect to /login without a session, so listing them would just advertise a
 * set of URLs that answer nothing.
 *
 * Derived from the same arrays the navigation and the agent pages are built
 * from, so a new agent appears here without anyone remembering to add it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Sign-in and sign-up are left out: they ask not to be indexed (their layouts),
  // and a sitemap that lists a page marked noindex is a contradiction Search
  // Console reports as an error.
  const staticPages = ['/', ...NAV.map((n) => n.href), '/privacy', '/terms'];
  const agentPages = AGENTS.map((a) => `/tools/${a.slug}`);
  // /calculators itself comes in with NAV.
  const calculatorPages = CALCULATORS.map((c) => `/calculators/${c.slug}`);
  // Published guides only. A draft is readable on a preview deployment and
  // nowhere a crawler is pointed.
  const guides = publishedGuides();
  // The glossary defines the guides' terms and links to them, so it stands or
  // falls with them.
  const guidePages = guides.length > 0 ? ['/guides', ...guides.map((g) => `/guides/${g.slug}`), '/glossary'] : [];

  // A Set, because /guides is both in NAV and the head of the guide pages.
  // A guide's own date, and the newest of them for the guides index. The other
  // pages carry none: a date nobody keeps true is worse than no date, because
  // a crawler that finds it wrong learns to ignore it.
  const dated = new Map<string, string>(guides.map((g) => [`/guides/${g.slug}`, g.updated]));
  if (guides.length > 0) dated.set('/guides', guides.map((g) => g.updated).sort().at(-1)!);
  if (guides.length > 0) dated.set('/glossary', dated.get('/guides')!);
  for (const c of CALCULATORS) dated.set(`/calculators/${c.slug}`, c.updated);
  dated.set('/calculators', CALCULATORS.map((c) => c.updated).sort().at(-1)!);

  return [...new Set([...staticPages, ...agentPages, ...guidePages, ...calculatorPages])].map((path) => ({
    url: new URL(path, CANONICAL_URL).toString(),
    ...(dated.has(path) ? { lastModified: dated.get(path) } : {}),
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : /^\/(tools|guides|calculators)/.test(path) ? 0.8 : 0.5,
  }));
}

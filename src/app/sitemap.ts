import type { MetadataRoute } from 'next';
import { AGENTS, CANONICAL_URL, NAV } from '@/lib/marketing/content';

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

  return [...staticPages, ...agentPages].map((path) => ({
    url: new URL(path, CANONICAL_URL).toString(),
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : path.startsWith('/tools') ? 0.8 : 0.5,
  }));
}

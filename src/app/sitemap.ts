import type { MetadataRoute } from 'next';
import { AGENTS, NAV, SITE_URL } from '@/lib/marketing/content';

/**
 * Only the public pages. The signed-in routes are deliberately absent — they
 * redirect to /login without a session, so listing them would just advertise a
 * set of URLs that answer nothing.
 *
 * Derived from the same arrays the navigation and the agent pages are built
 * from, so a new agent appears here without anyone remembering to add it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['/', ...NAV.map((n) => n.href), '/login', '/signup'];
  const agentPages = AGENTS.map((a) => `/agents/${a.slug}`);

  return [...staticPages, ...agentPages].map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : path.startsWith('/agents') ? 0.8 : 0.5,
  }));
}

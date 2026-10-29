import type { MetadataRoute } from 'next';
import { CANONICAL_URL } from '@/lib/marketing/content';
import { PROTECTED_PREFIXES } from '@/lib/routes';

/**
 * Keep crawlers out of the application.
 *
 * Not a security measure. The account screens redirect without a session, and
 * the workspace, though open to visitors since the login came off it, is a set
 * of app screens rather than pages to find in search: the public /tools pages
 * are what describe each tool, and those stay crawlable.
 */
const WORKSPACE = ['/hub', '/dashboard', '/vouchers', '/approvals', '/admin', '/reconcile', '/comps', '/contacts', '/tax-notices', '/true-property-cost', '/wealth-tracker', '/will-maker'];

/**
 * The crawlers behind search and answer engines, named so the welcome is
 * explicit rather than implied by `*`: Google and Bing (and so Copilot and
 * DuckDuckGo), ChatGPT's search and the fetches it makes for a user, Claude's,
 * Perplexity's, Apple's, and the training crawlers whose models people now ask
 * instead of searching. A crawler that finds its own name here reads only this
 * group, so it carries the same rules as everyone else.
 *
 * Every one of these is allowed on purpose. The public pages exist to be found
 * and quoted; nothing private is reachable without an account anyway. To keep
 * a crawler out of training, give it its own group with `disallow: '/'` (the
 * training ones are GPTBot, ClaudeBot, Google-Extended, Applebot-Extended,
 * CCBot); that does not take the site out of their search answers.
 */
const ANSWER_ENGINES = [
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'DuckAssistBot',
  'CCBot',
];

export default function robots(): MetadataRoute.Robots {
  // /md/ is where the Markdown copies live internally; they are reached as
  // /<page>.md, and the internal address is not a page of its own.
  const disallow = [...[...PROTECTED_PREFIXES, ...WORKSPACE].map((p) => `${p}/`), ...WORKSPACE, '/auth/', '/md/'];
  return {
    rules: [
      { userAgent: ANSWER_ENGINES, allow: '/', disallow },
      { userAgent: '*', allow: '/', disallow },
    ],
    sitemap: new URL('/sitemap.xml', CANONICAL_URL).toString(),
  };
}

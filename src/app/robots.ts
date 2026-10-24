import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/marketing/content';
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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...[...PROTECTED_PREFIXES, ...WORKSPACE].map((p) => `${p}/`), ...WORKSPACE, '/auth/'],
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
  };
}

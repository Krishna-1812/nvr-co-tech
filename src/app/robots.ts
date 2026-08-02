import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/marketing/content';
import { PROTECTED_PREFIXES } from '@/lib/routes';

/**
 * Keep crawlers out of the application.
 *
 * Those routes already redirect without a session, so this is not a security
 * measure — it stops a crawler filling its budget on URLs that only ever answer
 * with the login page, and stops /login appearing in results as though it were
 * six different pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...PROTECTED_PREFIXES.map((p) => `${p}/`), '/auth/'],
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
  };
}

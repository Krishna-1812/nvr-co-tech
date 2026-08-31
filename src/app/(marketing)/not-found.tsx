import { NotFoundPanel } from '@/components/marketing/NotFoundPanel';

/**
 * A 404 raised from inside the public site — today that means /agents/[slug]
 * with a slug that is not on the roster.
 *
 * The page itself is shared with the root not-found, which catches every URL
 * that matches no route at all. See NotFoundPanel for why those are two files.
 */
export default function MarketingNotFound() {
  return <NotFoundPanel />;
}

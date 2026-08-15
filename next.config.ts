import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    /*
     * The only external image this site loads, and it is admin-only.
     *
     * Company logos on the visitor-intelligence screens come from a free
     * no-auth brand index. A 200 from it is also a soft signal that the domain
     * we resolved belongs to a real company rather than being a plausible
     * string, which is the other half of why it is fetched at all.
     *
     * `unoptimized` at the call site: these are 36px marks, so putting them
     * through the optimiser would cost a server round-trip and a cache entry
     * each to save nothing.
     */
    remotePatterns: [{ protocol: 'https', hostname: 'logo.clearbit.com' }],
  },
  experimental: {
    /*
     * How long the browser may reuse a page it has already fetched.
     *
     * The default for a dynamic page is zero, which means going back, or clicking
     * Vouchers again after glancing at the dashboard, refetches and re-renders the
     * whole thing on the server. Everything in the signed-in app is dynamic, so
     * every navigation paid full price, including the ones that were only undoing
     * the last one.
     *
     * Thirty seconds is safe here because of how this app mutates: every workflow
     * action calls revalidatePath, and the components that submit them call
     * router.refresh(), which drops this cache entirely. Your own changes can never
     * be hidden by it. What it can hide, for up to half a minute, is somebody
     * else's — a voucher another approver has just cleared could linger in your
     * queue until you reload. That is the trade, and for a queue people work
     * through in minutes it is the right way round.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

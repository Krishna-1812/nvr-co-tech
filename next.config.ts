import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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

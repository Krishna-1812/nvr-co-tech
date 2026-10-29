import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * No source maps in the browser bundle.
   *
   * This is already Next's default, and `.next/static` has never contained a
   * .map file. It is pinned here because the default is the thing that protects
   * it: turning this on is a one-word change somebody makes while debugging a
   * production-only bug, and what it ships is the readable original of every
   * client component — the analytics gate, the approval rules, the shape of
   * every table this app talks to — served publicly and permanently, to anyone
   * who opens devtools. Stated explicitly so that switching it on has to be a
   * decision rather than a default nobody reviewed.
   */
  productionBrowserSourceMaps: false,

  /*
   * The headers a browser and an audit (Lighthouse, Search Console's security
   * report) look for, on every response. HSTS is already sent by the host.
   * Nothing on this site embeds itself in a frame or asks for the camera,
   * microphone or location, so those are refused outright; the referrer is
   * trimmed to the origin when a link leaves the site.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ];
  },

  /*
   * Landed Cost was renamed True Property Cost. Its two old addresses forward
   * for good, so a bookmark, a shared link or an indexed page still arrives.
   * These run before the proxy, so the signed-in one then asks for a session
   * at its new address like any other tool.
   */
  async redirects() {
    return [
      { source: '/landed-cost', destination: '/true-property-cost', permanent: true },
      { source: '/agents/landed-cost', destination: '/tools/true-property-cost', permanent: true },
      /*
       * The public tool pages were called agents, and lived under /agents,
       * until 17 Oct, when the owner asked for them to be called tools. The old
       * addresses are in search indexes, in llms.txt copies, and in links people
       * have already sent, so each forwards for good to the same page under
       * /tools. The landed-cost line above comes first so that address takes
       * one hop rather than two.
       */
      /*
       * Four roadmap tools were taken off the site on 28 Oct 2026, at the
       * owner's request. Google had already indexed their pages, so each one,
       * under /tools and under the old /agents, forwards for good to the tool
       * index rather than ending on a 404. Before /agents/:slug, for one hop.
       */
      ...['gst-reconciliation', 'tds-compliance', 'invoice-intake', 'audit-copilot'].flatMap((slug) => [
        { source: `/tools/${slug}`, destination: '/tools', permanent: true },
        { source: `/agents/${slug}`, destination: '/tools', permanent: true },
      ]),
      { source: '/agents', destination: '/tools', permanent: true },
      // Tax Notice Watch opened as a page of the Admin screen on 20 Oct 2026 and
      // became a tool of its own the same day; the morning emails of that day link here.
      { source: '/analytics/notices', destination: '/tax-notices', permanent: true },
      { source: '/agents/:slug', destination: '/tools/:slug', permanent: true },
    ];
  },

  /*
   * The Markdown copy of each public page (app/md, lib/marketing/markdown.ts),
   * for assistants and agents that read a page rather than look at it.
   *
   * Two ways in. A `.md` on the end of any public address (the home page is
   * /index.md), which is the convention llms.txt proposes. Or the page's own
   * address with `Accept: text/markdown`, which is how a growing number of
   * agents ask. Browsers never send that header, so nobody looking at the site
   * is affected. Only the pages that have a copy are rewritten; anything else
   * asked for as Markdown gets the ordinary page.
   */
  async rewrites() {
    const markdown = [{ type: 'header' as const, key: 'accept', value: '(.*)text/markdown(.*)' }];
    return {
      beforeFiles: [
        { source: '/:path+.md', destination: '/md/:path+' },
        { source: '/', has: markdown, destination: '/md/index' },
        { source: '/:section(tools|guides|calculators|glossary)', has: markdown, destination: '/md/:section' },
        { source: '/:section(tools|guides|calculators)/:slug', has: markdown, destination: '/md/:section/:slug' },
      ],
    };
  },

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

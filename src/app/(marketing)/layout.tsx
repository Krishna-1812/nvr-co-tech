import Script from 'next/script';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';

/**
 * Shell for every public page.
 *
 * `data-skin="night"` is what switches on the entire marketing token set (see
 * the block at the bottom of globals.css). It is set here rather than on <body>
 * because <body> is shared with the application, which has its own light/dark
 * system that this must not disturb — and must not be disturbed by.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
      No overflow clipping on this wrapper. Setting overflow-x here coerces the
      vertical axis to `auto`, which quietly makes this div the scroll container
      instead of the viewport — and then window.scrollY stops moving, taking the
      header's scroll state and scroll-linked reveals with it. The sideways
      clipping the auroras need is done on <body> in globals.css, where it
      propagates to the viewport and leaves window scrolling alone.
    */
    <div data-skin="night" className="relative min-h-dvh">
      {/*
        Scroll reveal starts elements at opacity 0 and JavaScript releases them;
        with no JavaScript that release never happens, and since Reveal wraps
        most of the site the whole page would be a blank dark rectangle. Undo
        the hidden state outright in that case.

        This used to carry a second rule, hiding a pinned scroll stage and
        showing a stacked fallback in its place. Nothing on the site pins any
        more, so there is nothing left for scripting to be responsible for
        laying out.
      */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />

      {/*
        Our own measurement, on our own origin, writing to our own database.
        There is no Google Analytics on this site and no third-party pixel of
        any kind; see public/a.js, which is the whole of the client side.

        `lazyOnload` because nothing it measures needs it to have run early —
        the one beacon it sends goes on the way out — and a marketing page
        should spend its first second painting rather than booting a tracker.
        It refuses to do anything at all under Do Not Track or Global Privacy
        Control, and asks before doing anything in the regions that expect to
        be asked.
      */}
      <Script src="/a.js" strategy="lazyOnload" />
    </div>
  );
}

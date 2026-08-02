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
        Scroll reveal starts elements at opacity 0 and JavaScript releases them.
        With scripting off that release never happens, so the whole site would
        be a blank dark page — undo the hidden state outright in that case.
      */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

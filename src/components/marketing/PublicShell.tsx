import Script from 'next/script';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

/**
 * The frame every public page hangs in: the night skin, the header, the footer,
 * and the one script this site runs.
 *
 * It lives here rather than inline in `(marketing)/layout.tsx` because the root
 * `not-found.tsx` needs the same frame and cannot have that layout. A root
 * not-found is rendered by Next inside the *root* layout only — route-group
 * layouts are not in its tree — so an unmatched URL had no way to reach the
 * public header and footer at all. Two copies of this markup would have drifted
 * within a release; one component cannot.
 *
 * `data-skin="night"` is what switches on the entire marketing token set (see
 * the block at the bottom of globals.css). It is set here rather than on <body>
 * because <body> is shared with the application, which has its own light/dark
 * system that this must not disturb — and must not be disturbed by.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
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
      */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      {/*
        The signed-in side has had one of these for a while; the public site had
        not, which meant a keyboard or screen-reader visitor tabbed through the
        mark, four navigation links and two buttons on every single page before
        reaching a word of it.

        Parked off the top of the window and slid back on when focused, rather
        than the `sr-only focus:not-sr-only` pair the app's two use. That pair
        does not survive being given padding: `sr-only` sets `padding: 0`, which
        wins over `px-4 py-2` whichever order they are written in, so the link
        appears as a light box hugging its own letters with nothing around them.
        A transform has nothing to fight over, and it stays in the accessibility
        tree throughout, which is the whole point of a skip link.

        z-[60], not z-50: the header is sticky at z-50 and comes after this in
        the document, so at equal z-index it paints on top and the link arrives
        underneath the logo.
      */}
      <a
        href="#main"
        className="absolute top-3 left-3 z-[60] -translate-y-24 rounded-lg bg-[var(--m-ink)] px-4 py-2 t-3 font-semibold text-[var(--m-on-grad)] transition-transform duration-200 focus:translate-y-0 motion-reduce:transition-none"
      >
        Skip to content
      </a>

      <SiteHeader />
      <main id="main">{children}</main>
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

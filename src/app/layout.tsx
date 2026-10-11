import type { Metadata, Viewport } from 'next';
import { BRAND, SITE_URL } from '@/lib/marketing/content';
import { DESERT_FONTS } from '@/lib/brand/fonts';
import './globals.css';

/*
 * Two faces for the whole product, public site and app alike: Figtree for
 * everything read, Gloock for headlines. Both live in lib/brand/fonts, which
 * says why there are only two. They go on <html> so the @theme font tokens,
 * which compile onto :root, can resolve them.
 */

export const metadata: Metadata = {
  // Makes every relative URL below — and in each page's own metadata — absolute.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} · ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.blurb,
  applicationName: BRAND.name,
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    locale: 'en_IN',
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description: BRAND.blurb,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description: BRAND.blurb,
  },
  /*
   * No robots tag. Absence already means "index, follow" to every crawler, so
   * the explicit tag that used to be here bought nothing — and it was inherited
   * by pages that must not be indexed. Next stamps its own `noindex` on a
   * not-found response, so every 404 went out carrying two robots tags that
   * disagreed. Crawlers take the most restrictive of a conflicting pair, so
   * nothing was ever wrongly indexed; it just made the head of a 404 look like
   * nobody had read it.
   *
   * The signed-in routes are excluded in robots.ts, and they redirect to /login
   * for anyone without a session anyway.
   */
};

/**
 * The colour a mobile browser paints its chrome with: the bone the whole
 * product is printed on. Kept out of `metadata` because Next wants it here,
 * and it is not indexable text.
 */
export const viewport: Viewport = {
  themeColor: '#F6EFE4',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
      The font variables go on <html>, not <body>.
      @theme compiles --font-sans and friends into :root, and a custom property
      declared on :root resolves its own var() references against :root. With
      next/font's variables one level down on <body> they were invisible from
      there, so every one of those tokens computed to nothing and the whole page
      quietly fell back to system sans.
    */
    <html
      lang="en-IN"
      suppressHydrationWarning
      className={DESERT_FONTS}
    >
      <head>
        {/*
          Apply the theme and rail width before first paint.

          Both are read from localStorage, so React cannot know either of them
          during server rendering. Without this, a dark-mode user gets a white
          flash on every navigation, and anyone who collapsed the rail watches it
          open and shut again once hydration lands.

          Light is the default: with nothing stored, `data-theme` is set to light
          rather than left off. The public site is the light desert, so a person
          arriving from it should sign in to the same room; leaving it off would
          follow the operating system and turn the product dark under anyone on a
          dark-set machine at the moment they signed in. A stored choice always
          wins, including an explicit 'system'.

          It has to be decided here rather than in CSS, because "no preference
          recorded" and "recorded as system" are different states and a media query
          cannot tell them apart. lib/theme.ts reads the same rule.

          The second statement decides the home page's opening sequence, for
          the same reason: it has to be known before the first frame, or the
          hero is painted and then covered. Home page only, once a session,
          never when arriving from another page of this site, never under
          reduced motion. See components/marketing/play/IntroCurtain.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,t=localStorage.getItem('theme');if(!t)d.setAttribute('data-theme','light');else if(t!=='system')d.setAttribute('data-theme',t);if(localStorage.getItem('rail')==='collapsed')d.setAttribute('data-rail','collapsed')}catch(e){}try{var d2=document.documentElement;if(location.pathname==='/'&&!sessionStorage.getItem('tfi-intro')&&document.referrer.indexOf(location.origin)!==0&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d2.setAttribute('data-intro','on')}catch(e){}`,
          }}
        />
      </head>
      {/*
        Nothing but the children. The toast host used to sit here, which shipped
        sonner to every public page for notifications that only ever happen on
        the signed-in side; it lives in the signed-in frame now. See
        components/app/Toasts.
      */}
      <body className="antialiased">{children}</body>
    </html>
  );
}

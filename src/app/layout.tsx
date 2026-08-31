import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { BRAND, SITE_URL } from '@/lib/marketing/content';
import { INK } from '@/lib/brand/mark';
import './globals.css';

/*
 * One voice, two supporting roles.
 *
 * Bricolage Grotesque carries everything — headlines and body, marketing and
 * application. It is the firm's face by choice, and the whole type system is
 * built on the two axes it ships.
 *
 * `opsz` is the reason one family can do both jobs. It retunes the letterforms
 * for the size they are actually set at: open and sturdy apertures in a 13px
 * table cell, tight ones with more stroke contrast in a 5rem headline. That is
 * a different drawing at each end rather than the same outlines scaled, which
 * is what a display/text pairing would otherwise be needed for. `body` turns it
 * on with `font-optical-sizing: auto` and the display utilities pin it to 72.
 *
 * `wdth` runs 75 to 100 and does the rest: the headline utilities narrow to 86
 * and the figures to 90, so a hero line and a rupee total are set rather than
 * enlarged. Note the floor — 75, not Archivo's 62 — which is why the width
 * settings here are gentler than they would be on a face drawn to condense
 * further, and why `s-settle-width` opens from 76 rather than lower.
 *
 * Instrument Serif stays for one job: the italic accent inside headlines.
 * Bricolage ships no italic, so the alternative is a browser-synthesised slant,
 * which is a sheared roman rather than an italic and looks it. JetBrains Mono
 * stays for eyebrows and any figure that has to line up in a column.
 *
 * All three are self-hosted by next/font — no render-blocking request to
 * Google, and no layout shift when they land.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
  variable: '--font-bricolage',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  // Italic only. `.m-serif` sets `font-style: italic` itself and is the only thing
  // that uses this family, so the roman was a file every page in the app
  // downloaded and preloaded at high priority and never painted a glyph from.
  style: ['italic'],
  variable: '--font-serif-stack',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-stack',
  display: 'swap',
});

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
 * The colour a mobile browser paints its chrome with, matched to the icon's
 * ground so the tile and the address bar are the same navy. Kept out of
 * `metadata` because Next wants it here, and it is not indexable text.
 */
export const viewport: Viewport = {
  themeColor: INK.navy,
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
      className={`${bricolage.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          Apply the theme and rail width before first paint.

          Both are read from localStorage, so React cannot know either of them
          during server rendering. Without this, a dark-mode user gets a white
          flash on every navigation, and anyone who collapsed the rail watches it
          open and shut again once hydration lands.

          Dark is the default: with nothing stored, `data-theme` is set to dark
          rather than left off. Leaving it off means following the operating system,
          which is a fine default for an app in general but not for this one — the
          public site is dark always, so a new person arriving from it on a
          light-set machine watched the product turn white at the moment they
          signed in. A stored choice always wins, including an explicit 'system'.

          It has to be decided here rather than in CSS, because "no preference
          recorded" and "recorded as system" are different states and a media query
          cannot tell them apart. lib/theme.ts reads the same rule.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,t=localStorage.getItem('theme');if(!t)d.setAttribute('data-theme','dark');else if(t!=='system')d.setAttribute('data-theme',t);if(localStorage.getItem('rail')==='collapsed')d.setAttribute('data-rail','collapsed')}catch(e){}`,
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

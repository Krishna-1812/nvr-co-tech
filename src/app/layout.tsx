import type { Metadata } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Toaster } from 'sonner';
import { BRAND, SITE_URL } from '@/lib/marketing/content';
import './globals.css';

/*
 * Four families, each doing one job.
 *
 * Inter carries the application — it is the one you read for an hour, and it
 * disappears, which is the whole point. The other three exist for the public
 * site: Space Grotesk gives headlines a shape Inter does not have, Instrument
 * Serif italic is the accent inside them, and JetBrains Mono carries the
 * eyebrows and any figure that has to line up in a column.
 *
 * All four are self-hosted by next/font, so there is no render-blocking request
 * to Google and no layout shift when they land.
 */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display-stack',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
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
   * Indexable by default, which is right for the pages a crawler can actually
   * reach. The signed-in routes are excluded in robots.ts rather than here —
   * they redirect to /login for anyone without a session anyway.
   */
  robots: { index: true, follow: true },
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          Apply the saved theme before first paint, otherwise a dark-mode user
          gets a white flash on every navigation.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}

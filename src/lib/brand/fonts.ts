import { Figtree, Gloock } from 'next/font/google';

/**
 * The public site's two faces, and only the public site's.
 *
 * Gloock is the display serif: one weight, high contrast, drawn for headlines
 * and nothing smaller. Figtree is everything else on those pages, labels
 * included. The desert skin has no monospace; a mono label is a dark-mode
 * habit, and on sand it reads as a terminal.
 *
 * They live here rather than in the root layout so that only the elements that
 * carry the skin (PublicShell and the sign-in layout) put the variables on the
 * page, and the app's own type cannot pick them up by accident.
 *
 * That does not stop the app downloading them. next/font preloads a face on
 * every route whose module graph imports it, and the root not-found renders
 * PublicShell, so this module is in every route's graph. Measured on a
 * production build: both faces are preloaded on /hub and /dashboard too, at
 * 17.6 KB (Gloock) and 20.2 KB (Figtree), once, then cached. Turning preload
 * off would save the app those 38 KB at the cost of a visible font swap on the
 * public site's first paint, which is the page that has to look right first
 * time; that trade was made deliberately.
 *
 * Gloock ships a single weight. Anything that asks it for bold gets a
 * synthesised smear, which is why the skin pins .m-display to 400 and turns
 * synthesis off.
 */
export const gloock = Gloock({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-gloock',
  display: 'swap',
});

export const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

/** Both variables, for the className of whatever element carries the skin. */
export const DESERT_FONTS = `${gloock.variable} ${figtree.variable}`;
